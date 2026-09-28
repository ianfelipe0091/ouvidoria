'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePlatformAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import { digits, isValidCnpj, isValidEmail } from '@/lib/validation'

type CompanyStatus = Database['public']['Enums']['company_status']
type SubscriptionStatus = Database['public']['Enums']['subscription_status']

export type Result = { error?: string; ok?: boolean; message?: string }

/*
 * Todas as ações daqui são do administrador da plataforma. Cada uma confere o
 * papel antes de agir — Server Actions são alcançáveis por POST direto — e as
 * funções no banco conferem de novo e registram a ação em audit_logs.
 */

function refresh(companyId: string) {
  revalidatePath('/master')
  revalidatePath('/master/empresas')
  revalidatePath(`/master/empresas/${companyId}`)
}

/** "1.234,56", "149,90", "149" ou "149.90" → número. */
function parseMoney(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').replace(/[R$\s]/g, '')
  if (!s) return null
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Data de um <input type="date"> (AAAA-MM-DD) → instante no fuso de Brasília.
 * `endOfDay` para vencimentos: "pago até 28/10" vale o dia 28 inteiro.
 */
function dateInput(raw: FormDataEntryValue | null, endOfDay = false): string | null {
  const s = String(raw ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return `${s}T${endOfDay ? '23:59:59' : '12:00:00'}-03:00`
}

// ------------------------------------------------------------- situação ----

/** Muda a situação da empresa (ativar, suspender, bloquear, cancelar). */
export async function setCompanyStatus(
  companyId: string,
  status: CompanyStatus,
  subscriptionStatus?: SubscriptionStatus,
): Promise<Result> {
  const { supabase } = await requirePlatformAdmin()

  const { error } = await supabase.rpc('set_company_status', {
    p_company_id: companyId,
    p_status: status,
    p_subscription_status: subscriptionStatus,
  })

  if (error) return { error: error.message }
  refresh(companyId)
  return { ok: true }
}

/** Troca o plano. Não mexe no período pago — isso é registrar pagamento. */
export async function setCompanyPlan(companyId: string, planSlug: string): Promise<Result> {
  const { supabase } = await requirePlatformAdmin()

  const { error } = await supabase.rpc('change_company_plan', {
    p_company_id: companyId,
    p_plan_slug: planSlug,
  })

  if (error) return { error: error.message }
  refresh(companyId)
  return { ok: true, message: 'Plano alterado.' }
}

// ------------------------------------------------------ dados cadastrais ----

const COMPANY_FIELDS = [
  'legal_name', 'trade_name', 'tax_id', 'email', 'phone', 'whatsapp', 'website',
  'contact_name', 'contact_email', 'contact_phone',
  'address_street', 'address_number', 'address_complement', 'address_district',
  'address_city', 'address_state', 'address_zip',
] as const

export async function updateCompany(
  companyId: string,
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const { supabase } = await requirePlatformAdmin()

  const data: Record<string, string> = {}
  for (const field of COMPANY_FIELDS) {
    data[field] = String(formData.get(field) ?? '').trim()
  }
  data.tax_id = digits(data.tax_id)
  data.email = data.email.toLowerCase()
  data.contact_email = data.contact_email.toLowerCase()

  if (!data.legal_name) return { error: 'Informe a razão social.' }

  // O CNPJ só é validado quando muda: um cadastro antigo com CNPJ irregular não
  // pode travar a edição de todos os outros campos.
  const { data: current } = await supabase
    .from('companies')
    .select('tax_id')
    .eq('id', companyId)
    .maybeSingle()
  if (data.tax_id !== digits(current?.tax_id ?? '') && !isValidCnpj(data.tax_id)) {
    return { error: 'CNPJ inválido. Confira os dígitos.' }
  }
  if (!isValidEmail(data.email)) return { error: 'Informe um e-mail válido para a empresa.' }
  if (data.contact_email && !isValidEmail(data.contact_email)) {
    return { error: 'O e-mail do responsável é inválido.' }
  }
  if (data.address_state && !/^[A-Za-z]{2}$/.test(data.address_state)) {
    return { error: 'UF deve ter 2 letras (ex.: SP).' }
  }

  const { error } = await supabase.rpc('admin_update_company', {
    p_company_id: companyId,
    p_data: data,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Já existe outra empresa com este CNPJ.' }
    return { error: error.message }
  }
  refresh(companyId)
  return { ok: true, message: 'Dados da empresa salvos.' }
}

// -------------------------------------------------------------- cobrança ----

export async function updateBilling(
  companyId: string,
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const { supabase } = await requirePlatformAdmin()

  const price = parseMoney(formData.get('contracted_price'))
  if (price === null) return { error: 'Informe o valor mensal contratado (ex.: 399,00).' }

  const { error } = await supabase.rpc('admin_update_billing', {
    p_company_id: companyId,
    p_contracted_price: price,
    p_current_period_end: dateInput(formData.get('current_period_end'), true) as string,
    p_trial_ends_at: dateInput(formData.get('trial_ends_at'), true) as string,
    p_grace_until: dateInput(formData.get('grace_until'), true) as string,
  })

  if (error) return { error: error.message }
  refresh(companyId)
  return { ok: true, message: 'Dados de cobrança salvos.' }
}

export async function registerPayment(
  companyId: string,
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const { supabase } = await requirePlatformAdmin()

  const amount = parseMoney(formData.get('amount'))
  const months = Number(formData.get('months') ?? 1)
  const method = String(formData.get('method') ?? '')
  const paidAt = dateInput(formData.get('paid_at'))
  const note = String(formData.get('note') ?? '').trim()

  if (amount === null) return { error: 'Informe o valor recebido (ex.: 149,00).' }
  if (!Number.isInteger(months) || months < 1 || months > 36) {
    return { error: 'Informe de 1 a 36 meses.' }
  }
  if (!paidAt) return { error: 'Informe a data do pagamento.' }

  const { data, error } = await supabase.rpc('admin_register_payment', {
    p_company_id: companyId,
    p_amount: amount,
    p_months: months,
    p_method: method,
    p_paid_at: paidAt,
    p_note: note || undefined,
  })

  if (error) return { error: error.message }
  refresh(companyId)

  const result = data as { number?: string; period_end?: string } | null
  const until = result?.period_end
    ? new Date(result.period_end).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : null
  return {
    ok: true,
    message: `Pagamento ${result?.number ?? ''} registrado.${until ? ` Pago até ${until}.` : ''}`,
  }
}

/** Marca inadimplente com N dias de tolerância (0 = bloqueia agora). */
export async function markOverdue(companyId: string, graceDays: number): Promise<Result> {
  const { supabase } = await requirePlatformAdmin()

  const { error } = await supabase.rpc('admin_mark_overdue', {
    p_company_id: companyId,
    p_grace_days: graceDays,
  })

  if (error) return { error: error.message }
  refresh(companyId)
  return { ok: true }
}

// ------------------------------------------------------------- exclusão ----

/**
 * Exclui a empresa de vez: dados do tenant, contas de login dos usuários dela
 * e os arquivos anexados às manifestações.
 *
 * Os caminhos dos anexos são lidos ANTES de apagar, porque a exclusão leva as
 * linhas junto. Os arquivos saem depois do banco: se o storage falhar, a
 * empresa já não existe e os arquivos ficam órfãos num bucket privado — pior
 * seria o contrário, a empresa continuar com anexos apontando para o nada.
 */
export async function deleteCompany(
  companyId: string,
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const { supabase } = await requirePlatformAdmin()
  const confirmSlug = String(formData.get('confirm_slug') ?? '').trim()

  const { data: files } = await supabase
    .from('attachments')
    .select('storage_path')
    .eq('company_id', companyId)
  const paths = (files ?? []).map((f) => f.storage_path)

  const { error } = await supabase.rpc('admin_delete_company', {
    p_company_id: companyId,
    p_confirm_slug: confirmSlug,
  })
  if (error) return { error: error.message }

  if (paths.length) {
    try {
      const admin = createAdminClient()
      for (let i = 0; i < paths.length; i += 100) {
        await admin.storage.from('anexos').remove(paths.slice(i, i + 100))
      }
    } catch {
      // A empresa já foi excluída; arquivos órfãos num bucket privado não
      // expõem nada e não impedem o resto.
    }
  }

  revalidatePath('/master')
  revalidatePath('/master/empresas')
  redirect(`/master/empresas?excluida=${encodeURIComponent(confirmSlug)}`)
}

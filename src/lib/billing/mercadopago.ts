import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import type { createAdminClient } from '@/lib/supabase/admin'

/*
 * Mercado Pago — Checkout Pro.
 *
 * O cliente paga um período (1, 3, 6 ou 12 meses) do plano escolhido, com
 * Pix, boleto ou cartão, na página do próprio Mercado Pago. Nada de cartão
 * passa por aqui. A confirmação chega pelo webhook e, como reforço, também no
 * retorno do cliente à tela de plano — as duas vias chamam `syncPayment`, que
 * é idempotente.
 *
 * Regra de ouro: o sistema só acredita no pagamento que ele mesmo busca na API
 * do Mercado Pago com o token secreto. A notificação é só um "vá conferir o
 * pagamento X"; forjar uma não adianta nada.
 */

// Sobrescrito apenas nos testes automatizados, que simulam a API.
const API = process.env.MERCADOPAGO_API_URL ?? 'https://api.mercadopago.com'

export const PAYABLE_MONTHS = [1, 3, 6, 12] as const

export function isMercadoPagoEnabled() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN)
}

function token() {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!t) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado.')
  return t
}

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = (body as { message?: string }).message ?? `HTTP ${res.status}`
    throw Object.assign(new Error(`Mercado Pago: ${message}`), { status: res.status })
  }
  return body as T
}

// --------------------------------------------------------------- checkout --

export type CheckoutRequest = {
  companyId: string
  companyName: string
  payerEmail: string
  plan: { slug: string; name: string; monthlyPrice: number }
  months: number
  /** URL pública da aplicação (https em produção). */
  baseUrl: string
}

/** Valor total de N meses, em reais com centavos exatos. */
export function periodAmount(monthlyPrice: number, months: number) {
  return Math.round(monthlyPrice * months * 100) / 100
}

/** Cria a preferência e devolve a URL do checkout do Mercado Pago. */
export async function createCheckout(req: CheckoutRequest) {
  const amount = periodAmount(req.plan.monthlyPrice, req.months)
  const period = req.months === 1 ? '1 mês' : `${req.months} meses`
  const isPublic = req.baseUrl.startsWith('https://')

  const pref = await mp<{ id: string; init_point: string }>('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [
        {
          id: `plano-${req.plan.slug}-${req.months}m`,
          title: `Nossa Ouvidoria — Plano ${req.plan.name} (${period})`,
          description: `Assinatura do plano ${req.plan.name} por ${period} para ${req.companyName}`,
          category_id: 'services',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amount,
        },
      ],
      payer: { email: req.payerEmail },
      // Referência que volta no pagamento: é por ela que o webhook sabe de
      // quem é o dinheiro e o que foi comprado.
      external_reference: `${req.companyId}:${req.plan.slug}:${req.months}`,
      metadata: { company_id: req.companyId, plan_slug: req.plan.slug, months: req.months },
      back_urls: {
        success: `${req.baseUrl}/painel/plano?checkout=sucesso`,
        pending: `${req.baseUrl}/painel/plano?checkout=pendente`,
        failure: `${req.baseUrl}/painel/plano?checkout=cancelado`,
      },
      // O Mercado Pago só aceita retorno automático e notificação para
      // endereços públicos; em desenvolvimento (http://localhost) ficam de fora.
      ...(isPublic
        ? { auto_return: 'approved', notification_url: `${req.baseUrl}/api/webhooks/mercadopago` }
        : {}),
      statement_descriptor: 'NOSSAOUVIDORIA',
      payment_methods: { installments: req.months >= 6 ? 12 : 1 },
    }),
  })

  return { id: pref.id, url: pref.init_point }
}

// -------------------------------------------------------------- pagamento --

export type MpPayment = {
  id: number
  status: string
  status_detail?: string
  transaction_amount: number
  currency_id: string
  date_approved: string | null
  date_created: string
  payment_method_id: string
  payment_type_id: string
  external_reference: string | null
  metadata?: { company_id?: string; plan_slug?: string; months?: number | string }
  point_of_interaction?: { transaction_data?: { ticket_url?: string } }
  transaction_details?: { external_resource_url?: string }
}

export function getPayment(id: string | number) {
  return mp<MpPayment>(`/v1/payments/${encodeURIComponent(String(id))}`)
}

/**
 * Confere a assinatura `x-signature` do Mercado Pago, quando há segredo
 * configurado. Formato: "ts=...,v1=..." com HMAC-SHA256 de
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
 */
export function validSignature(header: string, requestId: string | null, dataId: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(',').map((p) => p.trim().split('=', 2) as [string, string]),
  )
  if (!parts.ts || !parts.v1) return false
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
  let manifest = `id:${id};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${parts.ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(parts.v1)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ------------------------------------------------------------ aplicação ----

type Admin = ReturnType<typeof createAdminClient>

export type SyncResult = {
  ok: boolean
  /** O que aconteceu, para log e resposta do webhook. */
  outcome:
    | 'aplicado' | 'ja_aplicado' | 'pendente' | 'recusado' | 'estornado'
    | 'valor_divergente' | 'sem_referencia' | 'ignorado'
  companyId?: string
  periodEnd?: string
}

function reference(p: MpPayment) {
  const [refCompany, refPlan, refMonths] = (p.external_reference ?? '').split(':')
  const companyId = p.metadata?.company_id ?? refCompany
  const planSlug = p.metadata?.plan_slug ?? refPlan
  const months = Number(p.metadata?.months ?? refMonths)
  if (!companyId || !planSlug || !Number.isInteger(months) || months < 1 || months > 36) return null
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) return null
  return { companyId, planSlug, months }
}

const METHOD: Record<string, string> = {
  bank_transfer: 'pix', ticket: 'boleto', credit_card: 'cartao', debit_card: 'cartao',
  prepaid_card: 'cartao', account_money: 'outro',
}

/** Soma meses como o Postgres: 31/01 + 1 mês = 28/02 (ou 29), não 03/03. */
export function addMonths(date: Date, months: number) {
  const d = new Date(date)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d
}

/**
 * Leva ao banco o estado de um pagamento do Mercado Pago. Pode ser chamada
 * quantas vezes for — pelo webhook, pelo retorno do cliente, por reenvios —
 * e o período só é estendido uma vez por pagamento: a fatura, com chave única
 * (provider, provider_invoice_id), é a trava.
 */
export async function syncPayment(admin: Admin, payment: MpPayment): Promise<SyncResult> {
  const ref = reference(payment)
  if (!ref) return { ok: true, outcome: 'sem_referencia' }

  const providerInvoiceId = String(payment.id)
  const base = {
    company_id: ref.companyId,
    provider: 'mercadopago',
    provider_invoice_id: providerInvoiceId,
    number: `MP-${payment.id}`,
    amount_cents: Math.round(Number(payment.transaction_amount) * 100),
    currency: payment.currency_id || 'BRL',
    method: payment.payment_method_id === 'pix' ? 'pix' : METHOD[payment.payment_type_id] ?? 'outro',
    hosted_url:
      payment.point_of_interaction?.transaction_data?.ticket_url ??
      payment.transaction_details?.external_resource_url ??
      null,
  }

  const { data: company } = await admin.from('companies').select('id').eq('id', ref.companyId).maybeSingle()
  if (!company) return { ok: true, outcome: 'sem_referencia' }

  const { data: plan } = await admin
    .from('plans')
    .select('id, slug, name, monthly_price, self_service')
    .eq('slug', ref.planSlug)
    .maybeSingle()
  if (!plan) return { ok: true, outcome: 'sem_referencia', companyId: ref.companyId }

  const period = ref.months === 1 ? '1 mês' : `${ref.months} meses`
  const note = `Mercado Pago · plano ${plan.name} · ${period}`

  switch (payment.status) {
    case 'approved':
      break

    case 'pending':
    case 'in_process':
    case 'authorized': {
      // Pix gerado ou boleto emitido: a fatura aparece "em aberto", com o link
      // para o cliente concluir. Se já existe (qualquer estado), fica como está.
      await admin.from('invoices').insert({ ...base, status: 'aberta', note, due_at: null })
      return { ok: true, outcome: 'pendente', companyId: ref.companyId }
    }

    case 'rejected':
    case 'cancelled': {
      await admin
        .from('invoices')
        .update({ status: payment.status === 'rejected' ? 'falhou' : 'cancelada' })
        .eq('provider', 'mercadopago')
        .eq('provider_invoice_id', providerInvoiceId)
        .eq('status', 'aberta')
      return { ok: true, outcome: 'recusado', companyId: ref.companyId }
    }

    case 'refunded':
    case 'charged_back': {
      // O período já liberado não é retirado sozinho: estorno pede olhar
      // humano (devolução parcial, acordo). Fica registrado para o Master.
      const { data: changed } = await admin
        .from('invoices')
        .update({ status: 'estornada' })
        .eq('provider', 'mercadopago')
        .eq('provider_invoice_id', providerInvoiceId)
        .neq('status', 'estornada')
        .select('id')
      if (changed?.length) {
        await audit(admin, ref.companyId, 'pagamento.estornado', changed[0].id, {
          pagamento: providerInvoiceId, situacao: payment.status,
        })
      }
      return { ok: true, outcome: 'estornado', companyId: ref.companyId }
    }

    default:
      return { ok: true, outcome: 'ignorado', companyId: ref.companyId }
  }

  // --------------------------------------------------------- aprovado ----
  const paidAt = new Date(payment.date_approved ?? payment.date_created)
  const expected = Math.round(Number(plan.monthly_price) * ref.months * 100)
  const divergent = base.amount_cents + 1 < expected || base.currency !== 'BRL'

  const { data: sub } = await admin
    .from('subscriptions')
    .select('current_period_end')
    .eq('company_id', ref.companyId)
    .maybeSingle()
  if (!sub) return { ok: true, outcome: 'sem_referencia', companyId: ref.companyId }

  // Dias já pagos nunca se perdem: o período novo começa no fim do atual,
  // se ele ainda não acabou — a mesma regra do registro manual no Master.
  const currentEnd = sub.current_period_end ? new Date(sub.current_period_end) : null
  const start = currentEnd && currentEnd > paidAt ? currentEnd : paidAt
  const end = addMonths(start, ref.months)

  const paid = {
    ...base,
    status: 'paga' as const,
    paid_at: paidAt.toISOString(),
    period_start: divergent ? null : start.toISOString(),
    period_end: divergent ? null : end.toISOString(),
    due_at: start.toISOString(),
    note: divergent ? `${note} · valor abaixo do plano, período NÃO liberado — conferir` : note,
  }

  // A inserção é a trava: só um processamento por pagamento passa daqui.
  const { data: inserted, error: insertError } = await admin.from('invoices').insert(paid).select('id')
  let invoiceId = inserted?.[0]?.id as string | undefined
  if (insertError) {
    if (insertError.code !== '23505') throw new Error(`invoices: ${insertError.message}`)
    // Já existia (em aberto, de um Pix/boleto): só vira paga se ainda não era.
    const { data: promoted, error } = await admin
      .from('invoices')
      .update(paid)
      .eq('provider', 'mercadopago')
      .eq('provider_invoice_id', providerInvoiceId)
      .neq('status', 'paga')
      .neq('status', 'estornada')
      .select('id')
    if (error) throw new Error(`invoices: ${error.message}`)
    if (!promoted?.length) return { ok: true, outcome: 'ja_aplicado', companyId: ref.companyId }
    invoiceId = promoted[0].id
  }

  if (divergent) {
    await audit(admin, ref.companyId, 'pagamento.divergente', invoiceId, {
      pagamento: providerInvoiceId, recebido: base.amount_cents / 100, esperado: expected / 100,
      plano: plan.name, meses: ref.months,
    })
    return { ok: true, outcome: 'valor_divergente', companyId: ref.companyId }
  }

  const { error: subError } = await admin
    .from('subscriptions')
    .update({
      status: 'ativa',
      plan_id: plan.id,
      contracted_price: plan.monthly_price,
      trial_ends_at: null,
      grace_until: null,
      canceled_at: null,
      cancel_at_period_end: false,
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
    })
    .eq('company_id', ref.companyId)
  if (subError) throw new Error(`subscriptions: ${subError.message}`)

  // Suspensão por falta de pagamento se desfaz; bloqueio manual do Master não.
  await admin.from('companies').update({ status: 'ativa' }).eq('id', ref.companyId).eq('status', 'suspensa')

  await audit(admin, ref.companyId, 'pagamento.mercadopago', invoiceId, {
    pagamento: providerInvoiceId, valor: base.amount_cents / 100, meses: ref.months,
    plano: plan.name, forma: base.method, pago_ate: end.toISOString(),
  })

  return { ok: true, outcome: 'aplicado', companyId: ref.companyId, periodEnd: end.toISOString() }
}

async function audit(admin: Admin, companyId: string, action: string, entityId: string | undefined, changes: object) {
  await admin.from('audit_logs').insert({
    company_id: companyId,
    actor_id: null,
    actor_email: 'Mercado Pago',
    action,
    entity: 'invoices',
    entity_id: entityId ?? null,
    changes: changes as never,
  })
}

'use server'

import { revalidatePath } from 'next/cache'

import { requireCompanyAdmin } from '@/lib/auth'

export type Result = { error?: string; ok?: boolean; message?: string }

/**
 * Troca o plano da empresa.
 *
 * Sem cobrança real: a troca vale na hora. Quando entrar um meio de pagamento,
 * esta ação deixa de aplicar a mudança direto e passa a iniciar o checkout — a
 * assinatura só muda com o pagamento confirmado pelo provedor.
 */
export async function changePlan(planSlug: string): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()

  const { data, error } = await supabase.rpc('change_company_plan', {
    p_company_id: profile.company_id!,
    p_plan_slug: planSlug,
  })

  if (error) return { error: error.message }

  revalidatePath('/painel/plano')
  revalidatePath('/painel')
  return { ok: true, message: `Plano alterado para ${(data as { plan?: string })?.plan ?? planSlug}.` }
}

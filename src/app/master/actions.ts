'use server'

import { revalidatePath } from 'next/cache'

import { requirePlatformAdmin } from '@/lib/auth'
import type { Database } from '@/lib/supabase/database.types'

type CompanyStatus = Database['public']['Enums']['company_status']
type SubscriptionStatus = Database['public']['Enums']['subscription_status']

export type Result = { error?: string; ok?: boolean }

/**
 * Muda a situação de uma empresa cliente.
 *
 * Suspender e bloquear são operações do dono da plataforma — tipicamente por
 * inadimplência. A função no banco confere o papel de novo: esta ação é
 * alcançável por POST direto.
 */
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
  revalidatePath('/master')
  return { ok: true }
}

/** Troca o plano de uma empresa cliente pelo painel da plataforma. */
export async function setCompanyPlan(companyId: string, planSlug: string): Promise<Result> {
  const { supabase } = await requirePlatformAdmin()

  const { error } = await supabase.rpc('change_company_plan', {
    p_company_id: companyId,
    p_plan_slug: planSlug,
  })

  if (error) return { error: error.message }
  revalidatePath('/master')
  return { ok: true }
}

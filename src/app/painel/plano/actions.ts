'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { requireCompanyAdmin } from '@/lib/auth'
import { getBillingProvider } from '@/lib/billing'

export type Result = { error?: string; ok?: boolean; message?: string; redirectUrl?: string }

/** URL absoluta da própria aplicação, para o provedor devolver o cliente. */
async function baseUrl() {
  const host = (await headers()).get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
  return `${protocol}://${host}`
}

/**
 * Inicia a contratação de um plano.
 *
 * Com cobrança configurada, a assinatura NÃO muda aqui: a ação só abre o
 * checkout. Quem altera o plano é o webhook, depois do pagamento confirmado —
 * do contrário bastaria abandonar o checkout para ficar com o plano melhor.
 *
 * Sem cobrança configurada, a troca é aplicada direto. É o que mantém o produto
 * utilizável em avaliação e em desenvolvimento.
 */
export async function changePlan(planSlug: string): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()
  const companyId = profile.company_id!

  const provider = getBillingProvider()

  const { data: plan } = await supabase
    .from('plans')
    .select('name, provider_price_id')
    .eq('slug', planSlug)
    .maybeSingle()

  if (!plan) return { error: 'Plano não encontrado.' }

  if (!provider) {
    const { data, error } = await supabase.rpc('change_company_plan', {
      p_company_id: companyId,
      p_plan_slug: planSlug,
    })
    if (error) return { error: error.message }

    revalidatePath('/painel/plano')
    revalidatePath('/painel')
    return {
      ok: true,
      message: `Plano alterado para ${(data as { plan?: string })?.plan ?? plan.name}.`,
    }
  }

  if (!plan.provider_price_id) {
    return {
      error: `O plano ${plan.name} ainda não tem preço cadastrado no provedor de pagamento. Fale com o suporte.`,
    }
  }

  const [{ data: company }, { data: subscription }] = await Promise.all([
    supabase.from('companies').select('legal_name, trade_name, email').eq('id', companyId).maybeSingle(),
    supabase.from('subscriptions').select('provider_customer_id').eq('company_id', companyId).maybeSingle(),
  ])

  if (!company) return { error: 'Empresa não encontrada.' }

  const base = await baseUrl()

  try {
    const { url } = await provider.createCheckout({
      companyId,
      companyName: company.trade_name ?? company.legal_name,
      email: profile.email,
      priceId: plan.provider_price_id,
      customerId: subscription?.provider_customer_id,
      successUrl: `${base}/painel/plano?checkout=sucesso`,
      cancelUrl: `${base}/painel/plano?checkout=cancelado`,
    })
    return { ok: true, redirectUrl: url }
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : 'Não foi possível abrir o pagamento.',
    }
  }
}

/**
 * Abre o portal de cobrança do provedor.
 *
 * Trocar cartão, baixar nota e cancelar acontecem lá, e não aqui: reimplementar
 * isso significaria guardar dados de cartão, o que muda o nível de conformidade
 * exigido de todo o sistema.
 */
export async function openBillingPortal(): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()
  const provider = getBillingProvider()

  if (!provider) return { error: 'Cobrança não configurada.' }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('provider_customer_id')
    .eq('company_id', profile.company_id!)
    .maybeSingle()

  if (!subscription?.provider_customer_id) {
    return { error: 'Ainda não há uma assinatura paga para gerenciar.' }
  }

  try {
    const { url } = await provider.createPortalSession({
      customerId: subscription.provider_customer_id,
      returnUrl: `${await baseUrl()}/painel/plano`,
    })
    return { ok: true, redirectUrl: url }
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : 'Não foi possível abrir o portal.',
    }
  }
}

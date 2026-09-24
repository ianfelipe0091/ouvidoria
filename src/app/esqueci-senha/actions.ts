'use server'

import { headers } from 'next/headers'

import { createClient } from '@/lib/supabase/server'
import { isValidEmail } from '@/lib/validation'

export type ResetRequestState = { ok?: boolean; error?: string }

/** Base pública da requisição atual, para montar o link de retorno do e-mail. */
async function baseUrl() {
  const h = await headers()
  const host = h.get('host') ?? 'nossaouvidoria.com.br'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/**
 * Dispara o e-mail de recuperação de senha.
 *
 * A resposta é sempre a mesma para e-mail existente ou não: revelar a diferença
 * entregaria a lista de contas a quem ficasse testando endereços. O único erro
 * exposto é o limite de envios, que é operacional, não sobre a conta.
 *
 * O `redirectTo` traz a pessoa de volta para /auth/confirmar, que abre a sessão
 * de recuperação e segue para /redefinir-senha.
 */
export async function requestReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!isValidEmail(email)) return { error: 'Informe um e-mail válido.' }

  const supabase = await createClient()
  const redirectTo = `${await baseUrl()}/auth/confirmar?next=/redefinir-senha`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  // 429 = muitos pedidos no curto prazo (limite do provedor de e-mail).
  if (error?.status === 429) {
    return { error: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.' }
  }

  return { ok: true }
}

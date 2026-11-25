'use server'

import { TOO_MANY, allowIp } from '@/lib/rate-limit'
import { createPublicClient } from '@/lib/supabase/public'
import { isValidEmail } from '@/lib/validation'

export type ContactState = { ok?: boolean; error?: string; firstName?: string }

/**
 * Envio do formulário "Fale conosco".
 *
 * Grava pela função `submit_contact_message`, com o papel anônimo: o visitante
 * não lê nada e não usa a chave secreta. A função valida de novo no banco.
 */
export async function sendContact(_prev: ContactState, form: FormData): Promise<ContactState> {
  const name = String(form.get('name') ?? '').trim()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const phone = String(form.get('phone') ?? '').trim()
  const company = String(form.get('company') ?? '').trim()
  const message = String(form.get('message') ?? '').trim()

  // Proteção contra robôs: armadilha invisível, tempo mínimo de preenchimento
  // e limite por IP — a mesma receita do canal de manifestação.
  if (String(form.get('site_confirmacao_hp') ?? '').trim()) {
    return { error: 'Não foi possível enviar agora.' }
  }
  const startedAt = Number(form.get('started_at'))
  if (Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < 3000) {
    return { error: 'Revise os dados e envie novamente.' }
  }
  if (!(await allowIp('contato', 5, 10 * 60_000))) return { error: TOO_MANY }

  if (name.length < 2) return { error: 'Informe seu nome.' }
  if (!isValidEmail(email)) return { error: 'Informe um e-mail válido para a resposta.' }
  if (message.length < 10) return { error: 'Escreva a mensagem com pelo menos 10 caracteres.' }
  if (message.length > 4000) return { error: 'A mensagem passou de 4.000 caracteres. Resuma um pouco.' }

  const { error } = await createPublicClient().rpc('submit_contact_message', {
    p_name: name.slice(0, 120),
    p_email: email,
    p_phone: phone.slice(0, 40) || undefined,
    p_company: company.slice(0, 160) || undefined,
    p_message: message,
  })

  if (error) {
    console.error('[contato] falha ao gravar mensagem', error.message)
    return { error: 'Não foi possível enviar agora. Tente de novo ou chame no WhatsApp.' }
  }

  return { ok: true, firstName: name.split(/\s+/)[0] }
}

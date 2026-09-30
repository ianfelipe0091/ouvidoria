'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { TOO_MANY, allowIp } from '@/lib/rate-limit'

export type SignInState = { error?: string }

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Informe e-mail e senha.' }
  }

  // Adivinhação de senha: por IP e por conta.
  if (!(await allowIp('login', 30, 10 * 60_000)) || !(await allowIp(`login:${email.toLowerCase()}`, 8, 10 * 60_000))) {
    return { error: TOO_MANY }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // A mensagem é deliberadamente genérica: distinguir "e-mail não existe" de
    // "senha errada" entrega a lista de usuários a quem tentar adivinhar.
    return { error: 'E-mail ou senha inválidos.' }
  }

  redirect('/painel')
}

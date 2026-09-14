'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export type SignInState = { error?: string }

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Informe e-mail e senha.' }
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

'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { checkPassword } from '@/lib/validation'

export type NewPasswordState = { error?: string }

/**
 * Define a nova senha. Só funciona com a sessão de recuperação já aberta pelo
 * link do e-mail (via /auth/confirmar); sem ela, o Supabase recusa a troca.
 */
export async function setNewPassword(
  _prev: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('password_confirm') ?? '')

  const check = checkPassword(password)
  if (!check.ok) return { error: check.message }
  if (password !== confirm) return { error: 'As senhas não conferem.' }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) {
    return { error: 'A sessão de recuperação expirou. Peça um novo link.' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    // Ex.: a nova senha é igual à antiga, ou a sessão caiu no meio do caminho.
    return { error: 'Não foi possível alterar a senha. Tente novamente ou peça um novo link.' }
  }

  redirect('/painel')
}

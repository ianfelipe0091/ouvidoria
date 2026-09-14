import 'server-only'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']

/**
 * Sessão exigida numa página ou Server Action.
 *
 * Server Actions são alcançáveis por POST direto, fora da interface, então esta
 * checagem roda em toda ação de escrita. Ela não substitui o RLS — é a primeira
 * barreira; a última é o banco, que recusa o que não pertence ao tenant.
 */
export async function requireProfile(): Promise<{
  profile: Profile
  supabase: Awaited<ReturnType<typeof createClient>>
}> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()

  if (!auth?.user) {
    redirect('/entrar')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle()

  // Usuário autenticado sem perfil não tem tenant e não pode ver nada.
  // Acontece se o perfil foi removido enquanto a sessão seguia válida.
  if (!profile || profile.status !== 'ativo') {
    redirect('/entrar?erro=sem-acesso')
  }

  return { profile, supabase }
}

/** Igual a requireProfile, mas exige que o usuário administre a empresa. */
export async function requireCompanyAdmin() {
  const session = await requireProfile()
  if (!['platform_admin', 'company_admin'].includes(session.profile.role)) {
    redirect('/painel?erro=sem-permissao')
  }
  return session
}

export async function requirePlatformAdmin() {
  const session = await requireProfile()
  if (session.profile.role !== 'platform_admin') {
    redirect('/painel?erro=sem-permissao')
  }
  return session
}

/** Sessão opcional — para telas que mudam de forma quando há login. */
export async function currentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null

  const { data } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle()
  return data ?? null
}

import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']

/**
 * Sessão da requisição: usuário do Auth mais o perfil que o liga ao tenant.
 *
 * `cache()` é o ponto central. Layout e página pedem a sessão cada um — antes
 * isso custava duas validações de token e duas leituras de `profiles` por
 * navegação, em série. Com o cache, a primeira chamada resolve e as demais
 * reaproveitam o resultado dentro da mesma requisição.
 *
 * `getUser()` valida o token junto ao servidor de Auth; não troque por
 * `getSession()`, que apenas lê o cookie sem verificar a assinatura.
 */
const loadSession = cache(async () => {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()

  if (!auth?.user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle()

  return { supabase, user: auth.user, profile: profile ?? null }
})

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
  const { supabase, user, profile } = await loadSession()

  if (!user) {
    redirect('/entrar')
  }

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
  const { profile } = await loadSession()
  return profile
}

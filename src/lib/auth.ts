import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']

/**
 * Sessão da requisição: identidade do token mais o perfil que a liga ao tenant.
 *
 * Duas coisas seguram o custo aqui, porque isto roda em toda tela do painel:
 *
 * `cache()` do React — layout e página pedem a sessão cada um. Sem o cache,
 * cada navegação pagava duas vezes pela mesma verificação e pela mesma leitura
 * de `profiles`.
 *
 * `getClaims()` no lugar de `getUser()` — o projeto assina os tokens em ES256,
 * então a assinatura é conferida aqui mesmo, com a chave pública buscada uma
 * vez e reaproveitada. `getUser()` perguntava ao servidor de Auth a cada
 * renderização, o que custava uma ida à rede inteira por tela.
 *
 * A verificação continua sendo criptográfica: um token forjado ou adulterado
 * não passa. O que ela não enxerga é uma conta desativada no intervalo até o
 * token expirar — e isso o `status` do perfil, lido logo abaixo, cobre.
 *
 * Não troque por `getSession()`: esse lê o cookie sem conferir assinatura.
 */
const loadSession = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  if (!userId) return { supabase, userId: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  return { supabase, userId, profile: profile ?? null }
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
  const { supabase, userId, profile } = await loadSession()

  if (!userId) {
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

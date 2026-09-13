import 'server-only'

import { createClient } from './server'
import { supabasePublishableKey, supabaseUrl } from './env'

export type SupabaseHealth = {
  ok: boolean
  /** URL do projeto, quando as variáveis de ambiente estão configuradas. */
  url: string | null
  /** Latência da ida e volta até o projeto, em milissegundos. */
  latencyMs: number | null
  /** Há uma sessão de usuário autenticada nesta requisição. */
  authenticated: boolean
  /** Mensagem do erro que impediu a conexão, quando houver. */
  error: string | null
}

/**
 * Confirma que a aplicação alcança o projeto Supabase e que a chave é aceita.
 *
 * A checagem usa `GET /auth/v1/settings`, que responde 200 para uma chave
 * publicável válida e 401 para uma inválida — ou seja, valida de uma vez a
 * rede, a URL e a chave.
 *
 * Não use `auth.getUser()` para isso: sem cookie de sessão ele retorna
 * "Auth session missing" localmente, sem sequer tocar a rede, e por isso passa
 * mesmo com credenciais erradas.
 */
export async function checkSupabaseConnection(): Promise<SupabaseHealth> {
  let url: string | null = null
  const startedAt = Date.now()

  try {
    url = supabaseUrl()
    const key = supabasePublishableKey()

    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: 'no-store',
    })
    const latencyMs = Date.now() - startedAt

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      return {
        ok: false,
        url,
        latencyMs,
        authenticated: false,
        error: body?.message ?? `HTTP ${response.status}`,
      }
    }

    // O projeto respondeu. Só então vale checar se há usuário na sessão atual.
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()

    return { ok: true, url, latencyMs, authenticated: Boolean(data?.user), error: null }
  } catch (cause) {
    return {
      ok: false,
      url,
      latencyMs: Date.now() - startedAt,
      authenticated: false,
      error: cause instanceof Error ? cause.message : String(cause),
    }
  }
}

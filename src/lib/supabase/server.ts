import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import type { Database } from './database.types'
import { supabasePublishableKey, supabaseUrl } from './env'

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 *
 * Precisa ser criado a cada requisição: o store de cookies do Next.js é
 * específico da requisição em curso e não pode ser compartilhado entre elas.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components não podem escrever cookies. Quando a renderização
          // parte de um Server Component, o proxy (src/proxy.ts) já terá
          // renovado a sessão e gravado os cookies, então ignorar aqui é seguro.
        }
      },
    },
  })
}

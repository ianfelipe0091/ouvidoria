import { createBrowserClient } from '@supabase/ssr'

import type { Database } from './database.types'
import { supabasePublishableKey, supabaseUrl } from './env'

/**
 * Cliente Supabase para uso em Client Components ("use client").
 *
 * `createBrowserClient` já devolve a mesma instância a cada chamada, então pode
 * ser invocado livremente dentro de componentes sem criar conexões duplicadas.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey())
}

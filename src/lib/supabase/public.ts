import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'
import { supabasePublishableKey, supabaseUrl } from './env'

/**
 * Cliente para dados públicos — os que qualquer visitante pode ler, como a
 * tabela de planos da landing.
 *
 * Diferente de `createClient()` de `server.ts`, este NÃO toca em cookies. Essa
 * é a razão de existir: ler cookies marca a rota como dinâmica e obriga o Next
 * a renderizar a página a cada visita. Sem eles, a landing volta a ser
 * pré-renderizada e servida do cache da CDN.
 *
 * Continua sujeito ao RLS: sem sessão, enxerga apenas o que as políticas
 * liberam para o papel anônimo.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

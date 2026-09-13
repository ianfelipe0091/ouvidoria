import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'
import { supabaseSecretKey, supabaseUrl } from './env'

/**
 * Cliente administrativo, autenticado com a chave secreta.
 *
 * Ignora as políticas de RLS e enxerga todos os dados do projeto. Use apenas em
 * código que roda exclusivamente no servidor e nunca em resposta direta a
 * entrada não confiável do usuário. O import de `server-only` faz o build
 * falhar caso este módulo seja puxado para um bundle de browser.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

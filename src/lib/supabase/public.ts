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
    global: { headers: { 'x-build-id': BUILD_ID } },
  })
}

/**
 * Identifica o build. Vai como cabeçalho em toda consulta deste cliente para
 * mudar a chave do cache de dados do Next a cada deploy.
 *
 * Sem isso, a landing (estática, `revalidate = false`) guardava a resposta do
 * banco no Data Cache indefinidamente — e a Vercel restaura esse cache entre
 * builds. Um deploy depois de mudar os planos continuava servindo os antigos.
 * Com a chave por build, cada deploy consulta o banco uma vez e congela o
 * resultado, que é o comportamento pretendido.
 */
const BUILD_ID = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now())

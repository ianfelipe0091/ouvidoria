import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import type { Database } from './database.types'
import { supabasePublishableKey, supabaseUrl } from './env'

/**
 * Renova o token de sessão do Supabase a cada requisição e repassa os cookies
 * atualizados tanto para a requisição (lida pelos Server Components) quanto
 * para a resposta (gravada no browser).
 *
 * Sem isso, Server Components — que não conseguem escrever cookies — ficariam
 * com sessões expiradas e o usuário seria deslogado silenciosamente.
 */
export async function updateSession(request: NextRequest) {
  // O caminho da requisição segue num cabeçalho porque layouts do App Router
  // não recebem a rota atual. Quem precisa decidir por rota — como o bloqueio
  // por inadimplência, que tem de liberar a própria tela de pagamento — lê daqui.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        // A resposta é recriada para carregar os cookies já atualizados na
        // requisição; em seguida os mesmos cookies vão para o browser.
        response = NextResponse.next({ request: { headers: requestHeaders } })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // `getUser()` valida o token junto ao servidor de Auth e dispara a renovação.
  // Não troque por `getSession()` aqui: ele apenas lê o cookie, sem validar.
  await supabase.auth.getUser()

  return response
}

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

  // Sem cookie de sessão não há token para renovar, e o proxy roda em toda
  // requisição — inclusive na landing e no canal público, onde quase ninguém
  // está logado. Sair aqui poupa uma ida ao servidor de Auth em cada uma
  // dessas visitas. Quem tem sessão segue o caminho completo abaixo.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-'))
  if (!hasSession) return response

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

  // `getClaims()` verifica a assinatura do token localmente (o projeto assina em
  // ES256, e a chave pública é buscada uma vez e reaproveitada), e só vai à rede
  // quando o token de fato expirou — aí renova e regrava os cookies.
  //
  // Antes aqui havia `getUser()`, que consultava o servidor de Auth a CADA
  // requisição: com o banco a centenas de milissegundos de distância, era esse
  // o custo fixo somado a toda navegação do painel. A validação forte continua
  // existindo uma vez por requisição em `requireProfile()`, que é a barreira de
  // verdade — e abaixo dela, o RLS no banco.
  //
  // Não troque por `getSession()`: ele lê o cookie sem verificar a assinatura.
  await supabase.auth.getClaims()

  return response
}

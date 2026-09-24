import { NextResponse, type NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

/**
 * No Next.js 16 a convenção `middleware.ts` foi renomeada para `proxy.ts`
 * (mesmo comportamento, novo nome de arquivo e de export).
 */
export async function proxy(request: NextRequest) {
  // O canal público deixou de ficar em /ouvidoria/<empresa> e passou para
  // /<empresa> — mais curto e sem repetir "ouvidoria". Links e QR codes já
  // distribuídos apontam para o endereço antigo; um redirecionamento permanente
  // os mantém válidos e leva buscadores ao novo. Não casa /api/ouvidoria, que
  // tem outro prefixo.
  const { pathname } = request.nextUrl
  if (pathname === '/ouvidoria' || pathname.startsWith('/ouvidoria/')) {
    const url = request.nextUrl.clone() // preserva a query string
    url.pathname = pathname.slice('/ouvidoria'.length) || '/'
    // 308 preserva o método e sinaliza mudança permanente aos buscadores.
    return NextResponse.redirect(url, { status: 308 })
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Roda em todas as rotas, exceto arquivos que não precisam de sessão:
     * - _next/static e _next/image: assets gerados no build
     * - favicon.ico e imagens estáticas
     * Sem essa exclusão o proxy rodaria também para CSS, JS e imagens.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
}

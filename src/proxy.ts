import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

/**
 * No Next.js 16 a convenção `middleware.ts` foi renomeada para `proxy.ts`
 * (mesmo comportamento, novo nome de arquivo e de export).
 */
export async function proxy(request: NextRequest) {
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

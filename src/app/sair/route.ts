import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Encerramento de sessão. É POST de propósito: um GET permitiria deslogar
 * alguém com um simples <img src="/sair">.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/entrar', request.url), { status: 303 })
}

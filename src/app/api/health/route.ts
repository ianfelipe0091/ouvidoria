import { NextResponse } from 'next/server'

import { checkSupabaseConnection } from '@/lib/supabase/health'

// A checagem faz I/O de rede por requisição; nunca deve ser pré-renderizada.
export const dynamic = 'force-dynamic'

/** GET /api/health — verifica se a aplicação alcança o projeto Supabase. */
export async function GET() {
  const health = await checkSupabaseConnection()

  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}

import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Rotina diária de cobrança.
 *
 * Existe porque vencimento de prazo não é evento: o provedor avisa quando um
 * pagamento falha, mas ninguém avisa quando a tolerância acabou. Sem esta
 * rotina, uma empresa inadimplente seguiria com acesso indefinidamente.
 *
 * Protegida por segredo: a URL é pública e, sem isso, qualquer um poderia
 * disparar suspensões.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 503 })
  }

  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Servidor sem credenciais.' }, { status: 503 })
  }

  const { data, error } = await admin.rpc('expire_overdue_subscriptions')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, suspensas: data ?? 0 })
}

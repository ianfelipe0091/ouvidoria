import { NextResponse } from 'next/server'

import { getPayment, isMercadoPagoEnabled, syncPayment, validSignature } from '@/lib/billing/mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Notificações do Mercado Pago.
 *
 * A notificação traz só o id do pagamento. O conteúdo que vale é o que a rota
 * busca na API com o token secreto — por isso uma notificação forjada não
 * libera nada: no máximo faz o sistema reconferir um pagamento verdadeiro.
 * Com MERCADOPAGO_WEBHOOK_SECRET configurado, a assinatura também é conferida.
 *
 * Respostas: 200 para tudo que foi tratado ou não interessa (o Mercado Pago
 * para de reenviar); 5xx quando a falha é nossa ou da rede, para que reenvie.
 */
export async function POST(request: Request) {
  if (!isMercadoPagoEnabled()) {
    return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 503 })
  }

  const url = new URL(request.url)
  const body = (await request.json().catch(() => ({}))) as {
    type?: string; topic?: string; action?: string; data?: { id?: string | number }
  }

  // Dois formatos convivem: webhooks ({type, data.id}) e o IPN antigo
  // (?topic=payment&id=...). Merchant orders e afins não interessam.
  const type = body.type ?? body.topic ?? url.searchParams.get('type') ?? url.searchParams.get('topic')
  const dataId = String(body.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '')
  if (type !== 'payment' || !/^\d+$/.test(dataId)) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  const signature = request.headers.get('x-signature')
  if (secret && signature && !validSignature(signature, request.headers.get('x-request-id'), dataId, secret)) {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  }

  let payment
  try {
    payment = await getPayment(dataId)
  } catch (cause) {
    // 404: pagamento que não é desta conta (ou a notificação de teste do
    // painel, que usa um id fictício). Não adianta reenviar.
    if ((cause as { status?: number }).status === 404) {
      return NextResponse.json({ ok: true, ignored: true })
    }
    return NextResponse.json({ error: 'Falha ao consultar o Mercado Pago.' }, { status: 502 })
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Servidor sem credenciais.' }, { status: 503 })
  }

  // Trilha do que chegou. Conflito = mesma notificação reenviada; o
  // processamento abaixo é idempotente, então segue mesmo assim.
  const eventId = `payment:${payment.id}:${payment.status}`
  await admin.from('webhook_events').insert({
    provider: 'mercadopago',
    event_id: eventId,
    event_type: `payment.${payment.status}`,
    payload: { notification: body, status: payment.status, amount: payment.transaction_amount } as never,
  })

  try {
    const result = await syncPayment(admin, payment)
    await admin
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq('provider', 'mercadopago')
      .eq('event_id', eventId)
    return NextResponse.json(result)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    await admin
      .from('webhook_events')
      .update({ error: message })
      .eq('provider', 'mercadopago')
      .eq('event_id', eventId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

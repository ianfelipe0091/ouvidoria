import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getBillingProvider, type BillingEvent } from '@/lib/billing'

// O corpo cru é indispensável: a assinatura é calculada sobre os bytes
// originais, e qualquer reserialização a invalida.
export const dynamic = 'force-dynamic'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Recebe eventos do provedor de pagamento.
 *
 * Três garantias, nesta ordem:
 *
 * 1. Assinatura verificada antes de qualquer leitura do conteúdo. Sem isso,
 *    qualquer um que descobrisse a URL marcaria a própria assinatura como paga.
 * 2. Idempotência por `event_id`. Provedores reenviam eventos quando não
 *    recebem confirmação; sem a trava, um reenvio de "invoice.paid" duplicaria
 *    a fatura.
 * 3. Tolerância a ordem. Os eventos não chegam na ordem em que aconteceram,
 *    então o vínculo entre assinatura e empresa é feito por qualquer evento que
 *    carregue a empresa, e não só pelo checkout.
 */
export async function POST(request: Request) {
  const provider = getBillingProvider()
  if (!provider) {
    return NextResponse.json({ error: 'Cobrança não configurada.' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Assinatura ausente.' }, { status: 400 })
  }

  const rawBody = await request.text()

  let event: BillingEvent
  try {
    event = provider.parseWebhook(rawBody, signature)
  } catch (cause) {
    // 400 é deliberado: sinaliza ao provedor que o evento não deve ser
    // reenviado, porque reenviar um corpo inválido não vai melhorar.
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : 'Assinatura inválida.' },
      { status: 400 },
    )
  }

  let admin: Admin
  try {
    admin = createAdminClient()
  } catch {
    // 503 faz o provedor tentar de novo mais tarde, que é o certo aqui: o
    // evento é válido e a falha é nossa.
    return NextResponse.json({ error: 'Servidor sem credenciais.' }, { status: 503 })
  }

  // A trava de unicidade em (provider, event_id) é o que torna o reenvio
  // inofensivo — conflito significa "já processado".
  const { error: insertError } = await admin.from('webhook_events').insert({
    provider: provider.name,
    event_id: event.id,
    event_type: event.type,
    payload: event.raw as never,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    return NextResponse.json({ error: insertError.message }, { status: 503 })
  }

  try {
    if (event.subscription) await handleSubscription(admin, event)
    if (event.invoice) await handleInvoice(admin, event)

    await admin
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('provider', provider.name)
      .eq('event_id', event.id)

    return NextResponse.json({ ok: true })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)

    // O evento fica registrado com o erro para investigação, e devolvemos 503
    // para que o provedor reenvie — o registro sem processed_at permite que o
    // reenvio refaça o trabalho.
    await admin
      .from('webhook_events')
      .delete()
      .eq('provider', provider.name)
      .eq('event_id', event.id)

    await admin.from('webhook_events').insert({
      provider: provider.name,
      event_id: `${event.id}:erro:${Date.now()}`,
      event_type: event.type,
      payload: event.raw as never,
      error: message,
      processed_at: new Date().toISOString(),
    })

    return NextResponse.json({ error: message }, { status: 503 })
  }
}

async function handleSubscription(admin: Admin, event: BillingEvent) {
  const sub = event.subscription!

  // Amarra a assinatura do provedor ao tenant. Acontece no primeiro evento que
  // traga a empresa — normalmente o checkout, mas pode ser um subscription.*
  // que chegue antes dele.
  if (sub.companyId) {
    const { data: existing } = await admin
      .from('subscriptions')
      .select('id, provider_subscription_id')
      .eq('company_id', sub.companyId)
      .maybeSingle()

    if (existing && existing.provider_subscription_id !== sub.providerSubscriptionId) {
      await admin
        .from('subscriptions')
        .update({
          provider: 'stripe',
          provider_customer_id: sub.providerCustomerId,
          provider_subscription_id: sub.providerSubscriptionId,
        })
        .eq('id', existing.id)
    } else if (existing && sub.providerCustomerId) {
      await admin
        .from('subscriptions')
        .update({ provider_customer_id: sub.providerCustomerId })
        .eq('id', existing.id)
    }
  }

  // Status nulo significa que o provedor ainda não decidiu (checkout aberto,
  // pagamento em processamento). Mudar de estado aqui daria acesso antes da
  // confirmação.
  if (!sub.status) return

  const { data, error } = await admin.rpc('apply_subscription_state', {
    p_provider_subscription_id: sub.providerSubscriptionId,
    p_status: sub.status,
    p_plan_price_id: sub.priceId ?? undefined,
    p_period_start: sub.periodStart ?? undefined,
    p_period_end: sub.periodEnd ?? undefined,
    p_cancel_at_period_end: sub.cancelAtPeriodEnd ?? undefined,
  })

  if (error) throw new Error(`apply_subscription_state: ${error.message}`)

  const result = data as { ok: boolean; reason?: string } | null
  if (result && !result.ok) {
    throw new Error(`assinatura não vinculada: ${result.reason}`)
  }
}

async function handleInvoice(admin: Admin, event: BillingEvent) {
  const invoice = event.invoice!

  // A fatura pertence à empresa dona da assinatura. Sem o vínculo não há onde
  // guardá-la — pode ser um evento que chegou antes do checkout.
  const { data: subscription } = invoice.providerSubscriptionId
    ? await admin
        .from('subscriptions')
        .select('company_id')
        .eq('provider_subscription_id', invoice.providerSubscriptionId)
        .maybeSingle()
    : { data: null }

  if (!subscription) return

  // upsert pela chave do provedor: a mesma fatura muda de estado várias vezes
  // (finalizada → paga), e cada mudança é um evento novo sobre a mesma fatura.
  const { error } = await admin.from('invoices').upsert(
    {
      company_id: subscription.company_id,
      provider: 'stripe',
      provider_invoice_id: invoice.providerInvoiceId,
      number: invoice.number,
      status: invoice.status,
      amount_cents: invoice.amountCents,
      currency: invoice.currency,
      period_start: invoice.periodStart,
      period_end: invoice.periodEnd,
      due_at: invoice.dueAt,
      paid_at: invoice.paidAt,
      hosted_url: invoice.hostedUrl,
      pdf_url: invoice.pdfUrl,
    },
    { onConflict: 'provider,provider_invoice_id' },
  )

  if (error) throw new Error(`invoices: ${error.message}`)
}

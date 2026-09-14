/**
 * Teste da cobrança: assinatura de webhook, idempotência e máquina de estados.
 *
 * Não precisa de conta no provedor. O webhook do Stripe é autenticado por HMAC
 * sobre o corpo cru com um segredo compartilhado — gerando esse HMAC aqui,
 * exercitamos exatamente o mesmo caminho que a produção percorre, inclusive as
 * rejeições.
 *
 * O que fica de fora: as chamadas de saída ao provedor (abrir checkout, abrir
 * portal), que exigem chave real.
 *
 * Uso:
 *   BASE_URL=http://127.0.0.1:3000 STRIPE_WEBHOOK_SECRET=whsec_teste \
 *   node scripts/smoke-billing.mjs
 */
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch { /* variáveis podem vir do ambiente */ }

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const SECRET = process.env.STRIPE_WEBHOOK_SECRET
if (!SECRET) {
  console.error('Defina STRIPE_WEBHOOK_SECRET — o mesmo valor com que o servidor subiu.')
  process.exit(1)
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
)

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ok   ${name}`) }
  else { failed++; console.log(`  FALHA ${name}${detail ? ` — ${detail}` : ''}`) }
}

/** Assina como o provedor assina: HMAC-SHA256 sobre "timestamp.corpo". */
function sign(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

async function send(event, { secret = SECRET, signature } = {}) {
  const body = JSON.stringify(event)
  const response = await fetch(`${BASE}/api/webhooks/stripe`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature ?? sign(body, secret),
    },
    body,
  })
  return { status: response.status, json: await response.json().catch(() => null) }
}

const tag = Math.random().toString(36).slice(2, 8)
const CNPJ = (() => {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10))
  const digit = (nums) => {
    let sum = 0, weight = nums.length - 7
    for (const n of nums) { sum += n * weight--; if (weight < 2) weight = 9 }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  base.push(digit(base)); base.push(digit(base))
  return base.join('')
})()

const SUB_ID = `sub_teste_${tag}`
const CUS_ID = `cus_teste_${tag}`
const seconds = (d) => Math.floor(Date.now() / 1000) + d * 86400

let companyId = null

const subscriptionEvent = (id, status, extra = {}) => ({
  id,
  type: 'customer.subscription.updated',
  data: {
    object: {
      id: SUB_ID,
      customer: CUS_ID,
      status,
      cancel_at_period_end: false,
      metadata: { company_id: companyId },
      items: {
        data: [{
          price: { id: 'price_teste_professional' },
          current_period_start: seconds(-1),
          current_period_end: seconds(29),
        }],
      },
      ...extra,
    },
  },
})

try {
  // Empresa descartável, criada pelo mesmo caminho do cadastro real.
  const { data: slug } = await admin.rpc('suggest_company_slug', { p_name: `Cobranca ${tag}` })
  const { data: id, error } = await admin.rpc('provision_company', {
    p_slug: slug,
    p_legal_name: `Cobrança Teste ${tag} LTDA`,
    p_tax_id: CNPJ,
    p_email: `cobranca-${tag}@exemplo.test`,
    p_plan_slug: 'basic',
  })
  if (error) throw new Error(`provisionamento: ${error.message}`)
  companyId = id

  // O plano de destino precisa ter preço no provedor para a troca via webhook.
  await admin.from('plans').update({ provider_price_id: 'price_teste_professional' })
    .eq('slug', 'professional')

  console.log('\nVerificação de assinatura do webhook')

  const evento = subscriptionEvent(`evt_bad_${tag}`, 'active')
  const comAssinaturaErrada = await send(evento, { secret: 'whsec_outro_segredo' })
  check('assinatura com segredo errado é recusada', comAssinaturaErrada.status === 400,
    `HTTP ${comAssinaturaErrada.status}`)

  const semAssinatura = await fetch(`${BASE}/api/webhooks/stripe`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  })
  check('requisição sem assinatura é recusada', semAssinatura.status === 400,
    `HTTP ${semAssinatura.status}`)

  // Corpo alterado depois de assinado: o HMAC cobre os bytes, então tem de cair.
  const corpoOriginal = JSON.stringify(evento)
  const adulterado = await fetch(`${BASE}/api/webhooks/stripe`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': sign(corpoOriginal, SECRET),
    },
    body: corpoOriginal.replace('active', 'trialing'),
  })
  check('corpo adulterado após a assinatura é recusado', adulterado.status === 400,
    `HTTP ${adulterado.status}`)

  // Assinatura válida mas antiga: proteção contra reenvio de captura.
  const antigo = await send(subscriptionEvent(`evt_old_${tag}`, 'active'), {
    signature: sign(JSON.stringify(subscriptionEvent(`evt_old_${tag}`, 'active')), SECRET,
      Math.floor(Date.now() / 1000) - 86400),
  })
  check('evento antigo demais é recusado', antigo.status === 400, `HTTP ${antigo.status}`)

  console.log('\nVínculo e ativação')

  const checkout = await send({
    id: `evt_checkout_${tag}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_teste_${tag}`,
        subscription: SUB_ID,
        customer: CUS_ID,
        client_reference_id: companyId,
        metadata: { company_id: companyId },
      },
    },
  })
  check('checkout concluído é aceito', checkout.status === 200, `HTTP ${checkout.status}`)

  const { data: ligada } = await admin.from('subscriptions')
    .select('provider_subscription_id, provider_customer_id, status')
    .eq('company_id', companyId).maybeSingle()
  check('assinatura do provedor foi vinculada à empresa',
    ligada?.provider_subscription_id === SUB_ID && ligada?.provider_customer_id === CUS_ID)
  check('checkout sozinho NÃO marca como paga', ligada?.status === 'trial',
    `status ficou ${ligada?.status}`)

  const ativa = await send(subscriptionEvent(`evt_active_${tag}`, 'active'))
  check('assinatura ativa é aceita', ativa.status === 200, `HTTP ${ativa.status}`)

  const { data: depois } = await admin.from('subscriptions')
    .select('status, current_period_end, plans(name)').eq('company_id', companyId).maybeSingle()
  check('pagamento confirmado ativa a assinatura', depois?.status === 'ativa', depois?.status)
  check('plano é trocado pelo preço que o provedor informou',
    depois?.plans?.name === 'Professional', depois?.plans?.name)

  console.log('\nIdempotência')

  const reenvio = await send(subscriptionEvent(`evt_active_${tag}`, 'active'))
  check('reenvio do mesmo evento é ignorado',
    reenvio.status === 200 && reenvio.json?.duplicate === true,
    JSON.stringify(reenvio.json))

  console.log('\nFaturas')

  const fatura = {
    id: `evt_invoice_${tag}`,
    type: 'invoice.paid',
    data: {
      object: {
        id: `in_teste_${tag}`,
        subscription: SUB_ID,
        customer: CUS_ID,
        number: `FAT-${tag.toUpperCase()}`,
        status: 'paid',
        amount_due: 39900,
        currency: 'brl',
        period_start: seconds(-1),
        period_end: seconds(29),
        status_transitions: { paid_at: seconds(0) },
        hosted_invoice_url: 'https://exemplo.test/fatura',
        invoice_pdf: 'https://exemplo.test/fatura.pdf',
      },
    },
  }
  const faturaResp = await send(fatura)
  check('fatura paga é aceita', faturaResp.status === 200, `HTTP ${faturaResp.status}`)

  const { data: faturas } = await admin.from('invoices')
    .select('number, status, amount_cents, currency').eq('company_id', companyId)
  check('fatura foi registrada na empresa certa', faturas?.length === 1, `${faturas?.length}`)
  check('valor e moeda preservados',
    faturas?.[0]?.amount_cents === 39900 && faturas?.[0]?.currency === 'BRL',
    JSON.stringify(faturas?.[0]))

  // Mesma fatura, evento diferente: precisa atualizar, não duplicar.
  const refaturada = await send({ ...fatura, id: `evt_invoice2_${tag}` })
  const { data: faturasDepois } = await admin.from('invoices').select('id').eq('company_id', companyId)
  check('evento repetido sobre a mesma fatura não duplica',
    refaturada.status === 200 && faturasDepois?.length === 1, `${faturasDepois?.length}`)

  console.log('\nInadimplência e bloqueio')

  await send(subscriptionEvent(`evt_pastdue_${tag}`, 'past_due'))
  const { data: atrasada } = await admin.from('subscriptions')
    .select('status, grace_until').eq('company_id', companyId).maybeSingle()
  check('falha de pagamento marca inadimplência', atrasada?.status === 'inadimplente', atrasada?.status)
  check('tolerância é concedida', Boolean(atrasada?.grace_until))

  const { data: estadoNaTolerancia } = await admin.rpc('billing_state', { p_company_id: companyId })
  check('dentro da tolerância o acesso continua', estadoNaTolerancia?.blocked === false,
    JSON.stringify(estadoNaTolerancia?.blocked))

  // Vence a tolerância e confere o bloqueio.
  await admin.from('subscriptions')
    .update({ grace_until: new Date(Date.now() - 86400000).toISOString() })
    .eq('company_id', companyId)

  const { data: estadoVencido } = await admin.rpc('billing_state', { p_company_id: companyId })
  check('tolerância vencida bloqueia o acesso', estadoVencido?.blocked === true)

  const { data: suspensas } = await admin.rpc('expire_overdue_subscriptions')
  const { data: empresa } = await admin.from('companies').select('status').eq('id', companyId).maybeSingle()
  check('rotina suspende quem passou da tolerância',
    suspensas >= 1 && empresa?.status === 'suspensa', `${suspensas} / ${empresa?.status}`)

  console.log('\nRetomada após pagamento')

  await send(subscriptionEvent(`evt_recover_${tag}`, 'active'))
  const { data: recuperada } = await admin.from('subscriptions')
    .select('status, grace_until').eq('company_id', companyId).maybeSingle()
  const { data: empresaDepois } = await admin.from('companies')
    .select('status').eq('id', companyId).maybeSingle()
  check('pagamento regulariza a assinatura', recuperada?.status === 'ativa', recuperada?.status)
  check('tolerância é limpa ao regularizar', recuperada?.grace_until === null)
  check('empresa volta a ficar ativa', empresaDepois?.status === 'ativa', empresaDepois?.status)

  console.log('\nCancelamento')

  await send({
    id: `evt_cancel_${tag}`,
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: SUB_ID, customer: CUS_ID, status: 'canceled', cancel_at_period_end: false,
        metadata: { company_id: companyId },
        items: { data: [{ price: { id: 'price_teste_professional' },
          current_period_start: seconds(-1), current_period_end: seconds(29) }] },
      },
    },
  })
  const { data: cancelada } = await admin.from('subscriptions')
    .select('status, canceled_at, current_period_end').eq('company_id', companyId).maybeSingle()
  check('cancelamento é registrado', cancelada?.status === 'cancelada', cancelada?.status)
  check('data de cancelamento é gravada', Boolean(cancelada?.canceled_at))

  const { data: estadoCancelado } = await admin.rpc('billing_state', { p_company_id: companyId })
  check('acesso continua até o fim do período já pago', estadoCancelado?.blocked === false)

  console.log('\nAssinatura desconhecida')

  const orfa = await send({
    id: `evt_orfa_${tag}`,
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: `sub_inexistente_${tag}`, customer: 'cus_x', status: 'active',
        cancel_at_period_end: false, metadata: {},
        items: { data: [{ price: { id: 'price_teste_professional' },
          current_period_start: seconds(-1), current_period_end: seconds(29) }] },
      },
    },
  })
  check('evento de assinatura desconhecida não é dado como processado',
    orfa.status === 503, `HTTP ${orfa.status}`)
} catch (error) {
  failed++
  console.error('\nErro durante o teste:', error.message)
} finally {
  if (companyId) await admin.from('companies').delete().eq('id', companyId)
  await admin.from('plans').update({ provider_price_id: null }).eq('slug', 'professional')
  console.log(`\n${passed} verificações passaram, ${failed} falharam.`)
  process.exit(failed === 0 ? 0 : 1)
}

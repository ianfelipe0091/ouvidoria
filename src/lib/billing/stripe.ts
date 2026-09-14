import 'server-only'

import Stripe from 'stripe'

import type {
  BillingEvent, BillingProvider, CheckoutInput, InvoiceStatus, PortalInput, SubscriptionStatus,
} from './types'

/**
 * Tradução do vocabulário do Stripe para o do sistema.
 *
 * `incomplete` devolve null de propósito: significa "checkout começou, pagamento
 * ainda não confirmado". Tratá-lo como qualquer estado nosso daria acesso antes
 * do pagamento ou tiraria acesso de quem está só terminando de pagar.
 */
function toStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus | null {
  switch (stripeStatus) {
    case 'trialing': return 'trial'
    case 'active': return 'ativa'
    case 'past_due':
    case 'unpaid':
    case 'paused': return 'inadimplente'
    case 'canceled':
    case 'incomplete_expired': return 'cancelada'
    case 'incomplete': return null
    default: return null
  }
}

function toInvoiceStatus(status: Stripe.Invoice.Status | null): InvoiceStatus {
  switch (status) {
    case 'paid': return 'paga'
    case 'open': return 'aberta'
    case 'uncollectible': return 'falhou'
    case 'void': return 'cancelada'
    case 'draft': return 'aberta'
    default: return 'aberta'
  }
}

const toIso = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000).toISOString() : null

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === 'string' ? value : (value?.id ?? null)

export function createStripeProvider(secretKey: string, webhookSecret: string): BillingProvider {
  const stripe = new Stripe(secretKey)

  return {
    name: 'stripe',

    async createCheckout(input: CheckoutInput) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: input.priceId, quantity: 1 }],
        // Reaproveita o cadastro quando a empresa já comprou antes; senão o
        // Stripe criaria um cliente novo a cada compra e o histórico se perde.
        ...(input.customerId
          ? { customer: input.customerId }
          : { customer_email: input.email }),
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        // Carrega a empresa até o webhook: é por aqui que a assinatura criada
        // no Stripe volta a ser amarrada ao tenant certo.
        client_reference_id: input.companyId,
        subscription_data: {
          metadata: { company_id: input.companyId, company_name: input.companyName },
        },
        metadata: { company_id: input.companyId },
        locale: 'pt-BR',
        allow_promotion_codes: true,
      })

      if (!session.url) throw new Error('O provedor não devolveu a URL do checkout.')
      return { url: session.url }
    },

    async createPortalSession(input: PortalInput) {
      const session = await stripe.billingPortal.sessions.create({
        customer: input.customerId,
        return_url: input.returnUrl,
        locale: 'pt-BR',
      })
      return { url: session.url }
    },

    parseWebhook(rawBody: string, signature: string): BillingEvent {
      // Verifica HMAC e tolerância de tempo. Lança em assinatura inválida,
      // corpo alterado ou evento antigo demais (proteção contra replay).
      const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
      const base = { id: event.id, type: event.type, raw: event }

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object
          const subscriptionId = idOf(session.subscription)
          if (!subscriptionId) return base
          return {
            ...base,
            subscription: {
              providerSubscriptionId: subscriptionId,
              providerCustomerId: idOf(session.customer),
              // O checkout concluído não carrega o estado final da assinatura;
              // quem traz é o subscription.updated que vem logo atrás.
              status: null,
              priceId: null,
              periodStart: null,
              periodEnd: null,
              cancelAtPeriodEnd: null,
              companyId: session.client_reference_id ?? session.metadata?.company_id ?? null,
            },
          }
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object
          const item = subscription.items.data[0]
          return {
            ...base,
            subscription: {
              providerSubscriptionId: subscription.id,
              providerCustomerId: idOf(subscription.customer),
              status: event.type === 'customer.subscription.deleted'
                ? 'cancelada'
                : toStatus(subscription.status),
              priceId: item?.price?.id ?? null,
              periodStart: toIso(item?.current_period_start),
              periodEnd: toIso(item?.current_period_end),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              companyId: subscription.metadata?.company_id ?? null,
            },
          }
        }

        case 'invoice.paid':
        case 'invoice.payment_failed':
        case 'invoice.finalized': {
          const invoice = event.data.object
          const failed = event.type === 'invoice.payment_failed'
          return {
            ...base,
            invoice: {
              providerInvoiceId: invoice.id ?? '',
              providerSubscriptionId:
                idOf((invoice as { subscription?: string | { id: string } }).subscription),
              providerCustomerId: idOf(invoice.customer),
              number: invoice.number ?? null,
              status: failed ? 'falhou' : toInvoiceStatus(invoice.status),
              amountCents: invoice.amount_due ?? 0,
              currency: (invoice.currency ?? 'brl').toUpperCase(),
              periodStart: toIso(invoice.period_start),
              periodEnd: toIso(invoice.period_end),
              dueAt: toIso(invoice.due_date),
              paidAt: invoice.status === 'paid' ? toIso(invoice.status_transitions?.paid_at) : null,
              hostedUrl: invoice.hosted_invoice_url ?? null,
              pdfUrl: invoice.invoice_pdf ?? null,
            },
          }
        }

        default:
          return base
      }
    },
  }
}

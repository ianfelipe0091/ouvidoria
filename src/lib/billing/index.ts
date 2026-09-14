import 'server-only'

import { createStripeProvider } from './stripe'
import type { BillingProvider } from './types'

export type { BillingEvent, BillingProvider } from './types'

/**
 * Provedor configurado, ou null quando a cobrança ainda não foi ligada.
 *
 * Devolve null em vez de lançar porque o produto precisa continuar funcionando
 * sem cobrança configurada — em desenvolvimento, e para os clientes que já
 * estão em avaliação. As telas mostram o aviso adequado; nada quebra.
 */
export function getBillingProvider(): BillingProvider | null {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey || !webhookSecret) return null
  return createStripeProvider(secretKey, webhookSecret)
}

export function isBillingEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
}

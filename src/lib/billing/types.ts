/**
 * Contrato do provedor de pagamento.
 *
 * A aplicação conversa só com esta interface. Trocar Stripe por Pagar.me ou
 * Mercado Pago passa a ser escrever outra implementação, e não caçar chamadas
 * espalhadas por rotas e telas.
 */
import type { Database } from '@/lib/supabase/database.types'

export type SubscriptionStatus = Database['public']['Enums']['subscription_status']
export type InvoiceStatus = Database['public']['Enums']['invoice_status']

export type CheckoutInput = {
  companyId: string
  companyName: string
  /** E-mail que recebe o recibo e vira o cadastro do cliente no provedor. */
  email: string
  priceId: string
  /** Identificador do cliente no provedor, quando já existe. */
  customerId?: string | null
  successUrl: string
  cancelUrl: string
}

export type PortalInput = {
  customerId: string
  returnUrl: string
}

/** Evento já traduzido do formato do provedor para o vocabulário do sistema. */
export type BillingEvent = {
  id: string
  type: string
  /** Quando o evento fala de uma assinatura. */
  subscription?: {
    providerSubscriptionId: string
    providerCustomerId: string | null
    status: SubscriptionStatus | null
    priceId: string | null
    periodStart: string | null
    periodEnd: string | null
    cancelAtPeriodEnd: boolean | null
    /** Presente no checkout concluído, que é quando amarramos a empresa. */
    companyId?: string | null
  }
  /** Quando o evento fala de uma fatura. */
  invoice?: {
    providerInvoiceId: string
    providerSubscriptionId: string | null
    providerCustomerId: string | null
    number: string | null
    status: InvoiceStatus
    amountCents: number
    currency: string
    periodStart: string | null
    periodEnd: string | null
    dueAt: string | null
    paidAt: string | null
    hostedUrl: string | null
    pdfUrl: string | null
  }
  raw: unknown
}

export interface BillingProvider {
  readonly name: string
  /** Abre o checkout hospedado e devolve a URL para redirecionar o cliente. */
  createCheckout(input: CheckoutInput): Promise<{ url: string }>
  /** Portal onde o cliente troca o cartão, baixa faturas e cancela. */
  createPortalSession(input: PortalInput): Promise<{ url: string }>
  /**
   * Valida a assinatura criptográfica e traduz o evento.
   * Lança se a assinatura não confere — um webhook não verificado é uma porta
   * aberta para qualquer um marcar a própria assinatura como paga.
   */
  parseWebhook(rawBody: string, signature: string): BillingEvent
}

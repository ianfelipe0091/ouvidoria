'use client'

import { useState, useTransition } from 'react'

import { Button, FormError, LinkButton } from '@/components/ui'
import { salesWhatsappUrl } from '@/lib/brand'
import { PlanGrid, type PlanCard } from '@/components/marketing'
import { changePlan, openBillingPortal, startPayment } from './actions'

export function PlanChooser({
  plans, currentSlug, billingEnabled,
}: {
  plans: PlanCard[]
  currentSlug: string
  billingEnabled: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-3">
      <FormError message={error} />
      {message ? (
        <p className="rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">{message}</p>
      ) : null}

      <PlanGrid
        plans={plans}
        currentSlug={currentSlug}
        action={(plan) =>
          plan.slug === currentSlug ? (
            <Button variant="secondary" disabled>Plano atual</Button>
          ) : !plan.self_service ? (
            // Plano negociado não se assina daqui (o banco também recusa):
            // a conversa com o comercial é o caminho.
            <SalesButton planName={plan.name} />
          ) : (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setPendingSlug(plan.slug)
                  const result = await changePlan(plan.slug)
                  // Com cobrança ligada a ação devolve a URL do checkout: a
                  // troca só acontece depois do pagamento confirmado.
                  if (result.redirectUrl) {
                    window.location.href = result.redirectUrl
                    return
                  }
                  setError(result.error ?? null)
                  setMessage(result.message ?? null)
                  setPendingSlug(null)
                })
              }
            >
              {pending && pendingSlug === plan.slug
                ? 'Abrindo…'
                : billingEnabled
                  ? `Assinar ${plan.name}`
                  : `Mudar para ${plan.name}`}
            </Button>
          )
        }
      />
    </div>
  )
}

function SalesButton({ planName }: { planName: string }) {
  const href = salesWhatsappUrl(planName)
  return href ? (
    <LinkButton href={href} target="_blank" rel="noopener noreferrer" variant="secondary">
      Falar com especialista
    </LinkButton>
  ) : (
    <Button variant="secondary" disabled title="Canal de atendimento em configuração">
      Falar com especialista
    </Button>
  )
}

export function BillingPortalButton({ label = 'Gerenciar pagamento' }: { label?: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await openBillingPortal()
            if (result.redirectUrl) window.location.href = result.redirectUrl
            else setError(result.error ?? null)
          })
        }
      >
        {pending ? 'Abrindo…' : label}
      </Button>
      <FormError message={error} />
    </div>
  )
}

// ------------------------------------------------------- Mercado Pago ----

type PayablePlan = { slug: string; name: string; monthly_price: number }

const MONTH_OPTIONS = [1, 3, 6, 12] as const
const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Pagamento pelo Mercado Pago: escolhe o plano e quantos meses, e segue para o
 * checkout deles (Pix, boleto ou cartão). O plano atual vem pré-selecionado —
 * o caso mais comum é só renovar.
 */
export function PaymentPanel({
  plans, currentSlug,
}: {
  plans: PayablePlan[]
  currentSlug: string
}) {
  const initial = plans.some((p) => p.slug === currentSlug) ? currentSlug : plans[0]?.slug
  const [slug, setSlug] = useState(initial)
  const [months, setMonths] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const plan = plans.find((p) => p.slug === slug)
  if (!plan) return null
  const total = Math.round(plan.monthly_price * months * 100) / 100

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium">Plano</legend>
        <div className="flex flex-wrap gap-2">
          {plans.map((p) => (
            <label
              key={p.slug}
              className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm transition-colors ${
                p.slug === slug ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-muted'
              }`}
            >
              <input
                type="radio"
                name="plano"
                value={p.slug}
                checked={p.slug === slug}
                onChange={() => setSlug(p.slug)}
                className="sr-only"
              />
              <span className="font-medium">
                {p.name}
                {p.slug === currentSlug ? <span className="ml-1 text-[11px] font-normal text-muted">(atual)</span> : null}
              </span>
              <span className="text-xs text-muted">{BRL(p.monthly_price)}/mês</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium">Período</legend>
        <div className="flex flex-wrap gap-2">
          {MONTH_OPTIONS.map((m) => (
            <label
              key={m}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors ${
                m === months ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-border hover:bg-surface-muted'
              }`}
            >
              <input
                type="radio"
                name="meses"
                value={m}
                checked={m === months}
                onChange={() => setMonths(m)}
                className="sr-only"
              />
              {m === 1 ? '1 mês' : `${m} meses`}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted px-4 py-3">
        <div>
          <p className="text-xs text-muted">Total</p>
          <p className="text-xl font-semibold tabular-nums">{BRL(total)}</p>
          <p className="text-[11px] text-muted">
            Plano {plan.name} · {months === 1 ? '1 mês' : `${months} meses`}
            {months >= 6 ? ' · no cartão, em até 12x' : ''}
          </p>
        </div>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null)
              const result = await startPayment(plan.slug, months)
              if (result.redirectUrl) {
                window.location.href = result.redirectUrl
                return
              }
              setError(result.error ?? 'Não foi possível abrir o pagamento.')
            })
          }
        >
          {pending ? 'Abrindo o Mercado Pago…' : 'Pagar com Mercado Pago'}
        </Button>
      </div>
      <FormError message={error} />
      <p className="text-[11px] leading-relaxed text-muted">
        Pix, boleto ou cartão, no ambiente seguro do Mercado Pago. Pix e cartão liberam na hora; boleto, em
        até 3 dias úteis após o pagamento. Os dias que você já pagou não se perdem: o novo período começa no
        fim do atual.
      </p>
    </div>
  )
}

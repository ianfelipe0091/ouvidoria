'use client'

import { useState, useTransition } from 'react'

import { Button, FormError, LinkButton } from '@/components/ui'
import { salesWhatsappUrl } from '@/lib/brand'
import { PlanGrid, type PlanCard } from '@/components/marketing'
import { changePlan, openBillingPortal } from './actions'

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

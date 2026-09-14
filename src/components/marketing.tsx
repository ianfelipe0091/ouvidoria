import Link from 'next/link'

import { Badge, LinkButton, cn } from '@/components/ui'
import { BRAND, formatMoney } from '@/lib/brand'

/** Cabeçalho do site público. Distinto do cabeçalho do painel de propósito. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-semibold">{BRAND.name}</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/#planos" className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-muted">
            Planos
          </Link>
          <Link href="/entrar" className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-muted">
            Entrar
          </Link>
          <LinkButton href="/criar-conta" size="sm">
            Criar conta
          </LinkButton>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted">
        <span>
          {BRAND.name} · {BRAND.tagline}
        </span>
        <div className="flex gap-4">
          <Link href="/entrar" className="hover:text-foreground">Entrar</Link>
          <Link href="/criar-conta" className="hover:text-foreground">Criar conta</Link>
        </div>
      </div>
    </footer>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-foreground',
        className,
      )}
    >
      O
    </span>
  )
}

export type PlanCard = {
  id: string
  slug: string
  name: string
  description: string | null
  monthly_price: string | number
  max_branches: number | null
  max_users: number | null
  trial_days: number
  features: string[]
}

/**
 * Tabela de planos.
 *
 * `current` marca o plano vigente quando a tabela aparece dentro do painel;
 * `onSelect` só existe no painel, já que no site público a escolha vira o
 * cadastro.
 */
export function PlanGrid({
  plans, currentSlug, action,
}: {
  plans: PlanCard[]
  currentSlug?: string
  action?: (plan: PlanCard) => React.ReactNode
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((plan, index) => {
        const current = plan.slug === currentSlug
        // O plano do meio é o que a maioria contrata; destacá-lo é honesto e
        // evita que a pessoa tenha de comparar três colunas do zero.
        const featured = !currentSlug && index === 1

        return (
          <div
            key={plan.id}
            className={cn(
              'flex flex-col gap-4 rounded-xl border p-5',
              current
                ? 'border-accent bg-accent-soft'
                : featured
                  ? 'border-accent bg-surface'
                  : 'border-border bg-surface',
            )}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{plan.name}</h3>
                {current ? <Badge tone="accent">Plano atual</Badge> : null}
                {featured ? <Badge tone="accent">Mais contratado</Badge> : null}
              </div>
              <p className="text-xs leading-relaxed text-muted">{plan.description}</p>
            </div>

            <p className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tracking-tight">
                {formatMoney(plan.monthly_price)}
              </span>
              <span className="text-xs text-muted">/mês</span>
            </p>

            <ul className="flex flex-1 flex-col gap-1.5 text-xs">
              <li className="flex gap-2">
                <Check />
                {plan.max_branches === null
                  ? 'Filiais ilimitadas'
                  : `Até ${plan.max_branches} ${plan.max_branches === 1 ? 'filial' : 'filiais'}`}
              </li>
              <li className="flex gap-2">
                <Check />
                {plan.max_users === null ? 'Usuários ilimitados' : `Até ${plan.max_users} usuários`}
              </li>
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check />
                  {feature}
                </li>
              ))}
            </ul>

            {action ? action(plan) : (
              <LinkButton
                href={`/criar-conta?plano=${plan.slug}`}
                variant={featured ? 'primary' : 'secondary'}
              >
                Testar {plan.trial_days} dias grátis
              </LinkButton>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Check() {
  return (
    <span aria-hidden className="mt-0.5 shrink-0 text-accent">
      ✓
    </span>
  )
}

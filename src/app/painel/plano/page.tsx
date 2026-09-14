import { notFound } from 'next/navigation'

import { Badge, Card, CardHeader, PageHeader } from '@/components/ui'
import type { PlanCard } from '@/components/marketing'
import {
  SUBSCRIPTION_LABEL, SUBSCRIPTION_TONE, daysUntil, formatLimit, formatMoney,
} from '@/lib/brand'
import { requireCompanyAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/domain'
import { PlanChooser } from './client'

type Usage = { branches: number; users: number; occurrences_month: number }

export default async function PlanPage() {
  const { profile, supabase } = await requireCompanyAdmin()
  const companyId = profile.company_id!

  const [subscription, plans, usage] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('status, trial_ends_at, current_period_end, contracted_price, plans(*)')
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase
      .from('plans')
      .select('id, slug, name, description, monthly_price, max_branches, max_users, trial_days, features')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('sort_order'),
    supabase.rpc('company_usage', { p_company_id: companyId }),
  ])

  if (!subscription.data?.plans) notFound()

  const plan = subscription.data.plans
  const used = (usage.data as unknown as Usage) ?? { branches: 0, users: 0, occurrences_month: 0 }
  const trialLeft = daysUntil(subscription.data.trial_ends_at)

  const cards = (plans.data ?? []).map((p) => ({
    ...p,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
  })) satisfies PlanCard[]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Plano e assinatura"
        description="Seu plano atual, o quanto você está usando e as opções de mudança."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="px-4 py-3">
          <p className="text-xs text-muted">Plano atual</p>
          <p className="mt-1 text-lg font-semibold">{plan.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatMoney(subscription.data.contracted_price)}/mês
          </p>
        </Card>

        <Card className="px-4 py-3">
          <p className="text-xs text-muted">Situação</p>
          <p className="mt-1">
            <Badge tone={SUBSCRIPTION_TONE[subscription.data.status]}>
              {SUBSCRIPTION_LABEL[subscription.data.status]}
            </Badge>
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {subscription.data.status === 'trial' && trialLeft !== null
              ? trialLeft > 0
                ? `${trialLeft} ${trialLeft === 1 ? 'dia restante' : 'dias restantes'} de avaliação`
                : 'Período de avaliação encerrado'
              : subscription.data.current_period_end
                ? `Ciclo até ${formatDate(subscription.data.current_period_end)}`
                : '—'}
          </p>
        </Card>

        <Card className="px-4 py-3">
          <p className="text-xs text-muted">Manifestações no mês</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{used.occurrences_month}</p>
          <p className="mt-0.5 text-xs text-muted">sem limite no seu plano</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Uso dos limites"
          description="Ao atingir o limite, o cadastro é recusado até você liberar espaço ou trocar de plano."
        />
        <div className="flex flex-col gap-4 px-5 py-4">
          <LimitBar label="Filiais ativas" used={used.branches} limit={plan.max_branches} />
          <LimitBar label="Usuários ativos" used={used.users} limit={plan.max_users} />
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Mudar de plano</h2>
        <p className="text-xs text-muted">
          A mudança vale imediatamente. Ainda não há cobrança automática — a
          equipe comercial entra em contato para acertar o faturamento.
        </p>
        <PlanChooser plans={cards} currentSlug={plan.slug} />
      </section>
    </div>
  )
}

function LimitBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const ratio = limit === null ? 0 : Math.min(1, used / limit)
  const full = limit !== null && used >= limit
  const near = limit !== null && !full && ratio >= 0.8

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span>{label}</span>
        <span className={full ? 'font-medium text-danger' : near ? 'font-medium text-warn' : 'text-muted'}>
          {formatLimit(used, limit)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-chart-grid">
        <div
          className={`h-1.5 rounded-r-full ${full ? 'bg-danger' : near ? 'bg-warn' : 'bg-chart'}`}
          style={{ width: limit === null ? '100%' : `${Math.max(3, ratio * 100)}%` }}
          role="img"
          aria-label={`${label}: ${formatLimit(used, limit)}`}
        />
      </div>
      {full ? (
        <p className="text-xs text-danger">
          Limite atingido. Troque de plano para cadastrar mais.
        </p>
      ) : null}
    </div>
  )
}

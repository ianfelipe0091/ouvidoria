import { notFound } from 'next/navigation'

import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import type { PlanCard } from '@/components/marketing'
import {
  SUBSCRIPTION_LABEL, SUBSCRIPTION_TONE, daysUntil, formatLimit, formatMoney,
} from '@/lib/brand'
import { requireCompanyAdmin } from '@/lib/auth'
import { isBillingEnabled } from '@/lib/billing'
import { formatDate } from '@/lib/domain'
import { BillingPortalButton, PlanChooser } from './client'

type Usage = { branches: number; users: number; occurrences_month: number }

const INVOICE_LABEL = {
  aberta: 'Em aberto',
  paga: 'Paga',
  falhou: 'Falhou',
  estornada: 'Estornada',
  cancelada: 'Cancelada',
} as const

const INVOICE_TONE = {
  aberta: 'info',
  paga: 'ok',
  falhou: 'danger',
  estornada: 'warn',
  cancelada: 'neutral',
} as const

export default async function PlanPage(props: PageProps<'/painel/plano'>) {
  const params = await props.searchParams
  const { profile, supabase } = await requireCompanyAdmin()
  const companyId = profile.company_id!
  const billingEnabled = isBillingEnabled()

  const [subscription, plans, usage, invoices] = await Promise.all([
    supabase
      .from('subscriptions')
      .select(
        'status, trial_ends_at, current_period_end, contracted_price, cancel_at_period_end, grace_until, provider_customer_id, plans(*)',
      )
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase
      .from('plans')
      .select('id, slug, name, description, monthly_price, max_branches, max_users, trial_days, features, self_service')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('sort_order'),
    supabase.rpc('company_usage', { p_company_id: companyId }),
    supabase
      .from('invoices')
      .select('id, number, status, amount_cents, currency, paid_at, due_at, hosted_url, pdf_url, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  if (!subscription.data?.plans) notFound()

  const plan = subscription.data.plans
  const used = (usage.data as unknown as Usage) ?? { branches: 0, users: 0, occurrences_month: 0 }
  const trialLeft = daysUntil(subscription.data.trial_ends_at)
  const graceLeft = daysUntil(subscription.data.grace_until)
  const checkout = typeof params.checkout === 'string' ? params.checkout : null

  const cards = (plans.data ?? []).map((p) => ({
    ...p,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
  })) satisfies PlanCard[]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Plano e cobrança"
        description="Seu plano, o quanto você usa, suas faturas e as opções de mudança."
        action={subscription.data.provider_customer_id ? <BillingPortalButton /> : undefined}
      />

      {/* O retorno do checkout é informativo: o plano só muda quando o webhook
          confirma o pagamento, o que pode levar alguns segundos. */}
      {checkout === 'sucesso' ? (
        <p className="rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">
          Pagamento recebido. A mudança de plano aparece aqui assim que o provedor
          confirmar — normalmente em alguns segundos.
        </p>
      ) : null}
      {checkout === 'cancelado' ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          Pagamento não concluído. Seu plano atual continua valendo.
        </p>
      ) : null}

      {subscription.data.status === 'inadimplente' ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          Não conseguimos processar o último pagamento.
          {graceLeft !== null && graceLeft > 0
            ? ` O acesso continua por mais ${graceLeft} ${graceLeft === 1 ? 'dia' : 'dias'}.`
            : ' O acesso ao painel está suspenso.'}{' '}
          Atualize a forma de pagamento para regularizar.
        </p>
      ) : null}

      {subscription.data.cancel_at_period_end ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          Assinatura cancelada. O acesso continua até{' '}
          {formatDate(subscription.data.current_period_end)}, fim do período já pago.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="px-4 py-3">
          <p className="text-xs text-muted">Plano atual</p>
          <p className="mt-1 text-lg font-semibold">{plan.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {/* Plano negociado sem valor registrado: "R$ 0,00" pareceria gratuito. */}
            {!plan.self_service && Number(subscription.data.contracted_price) === 0
              ? 'Valor personalizado'
              : `${formatMoney(subscription.data.contracted_price)}/mês`}
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

      <Card>
        <CardHeader
          title="Faturas"
          description={
            billingEnabled
              ? 'Emitidas pelo provedor de pagamento.'
              : 'Aparecem aqui quando a cobrança automática for ativada.'
          }
        />
        {!invoices.data?.length ? (
          <EmptyState
            title="Nenhuma fatura ainda"
            description={
              billingEnabled
                ? 'A primeira fatura é gerada quando você assinar um plano.'
                : 'O faturamento está sendo acertado fora do sistema.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Fatura</th>
                  <th scope="col" className="px-5 py-3 font-medium">Valor</th>
                  <th scope="col" className="px-5 py-3 font-medium">Situação</th>
                  <th scope="col" className="px-5 py-3 font-medium">Data</th>
                  <th scope="col" className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.data.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-mono text-xs">{invoice.number ?? '—'}</td>
                    <td className="px-5 py-3 text-xs tabular-nums">
                      {formatMoney(invoice.amount_cents / 100)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={INVOICE_TONE[invoice.status]}>
                        {INVOICE_LABEL[invoice.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {formatDate(invoice.paid_at ?? invoice.due_at ?? invoice.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right text-xs">
                      {invoice.pdf_url ? (
                        <a
                          href={invoice.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-4"
                        >
                          PDF
                        </a>
                      ) : invoice.hosted_url ? (
                        <a
                          href={invoice.hosted_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-4"
                        >
                          Ver
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">
          {billingEnabled ? 'Assinar ou mudar de plano' : 'Mudar de plano'}
        </h2>
        <p className="text-xs text-muted">
          {billingEnabled
            ? 'O pagamento é processado pelo provedor. Seu plano muda assim que o pagamento for confirmado.'
            : 'A cobrança automática ainda não está ativa: a mudança vale na hora e o faturamento é acertado pelo comercial.'}
        </p>
        <PlanChooser plans={cards} currentSlug={plan.slug} billingEnabled={billingEnabled} />
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
        <p className="text-xs text-danger">Limite atingido. Troque de plano para cadastrar mais.</p>
      ) : null}
    </div>
  )
}

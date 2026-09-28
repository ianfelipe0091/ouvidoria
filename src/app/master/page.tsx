import Link from 'next/link'

import { BarList, StatTile } from '@/components/charts'
import { Icon } from '@/components/landing/icons'
import { KpiCard, MonthlyBars, PortfolioBar, type PortfolioSlice } from '@/components/master-charts'
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui'
import { requirePlatformAdmin } from '@/lib/auth'
import { formatMoney } from '@/lib/brand'
import { byMonth, countByCompany, fetchAll, lastMonths, loadPortfolio, whatsappLink, type PortfolioRow } from './data'

const DAY = 86_400_000

export default async function MasterOverviewPage() {
  const { supabase } = await requirePlatformAdmin()
  const months = lastMonths(6)
  const since = months[0].start
  const now = new Date().toISOString()

  const [rows, plans, invoices, occurrences, branches, users, late] = await Promise.all([
    loadPortfolio(supabase),
    supabase.from('plans').select('slug, name, monthly_price, self_service').eq('is_active', true).order('sort_order'),
    fetchAll((from, to) =>
      supabase
        .from('invoices')
        .select('amount_cents, paid_at')
        .eq('status', 'paga')
        .gte('paid_at', since)
        .order('id')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from('occurrences')
        .select('company_id, opened_at')
        .gte('opened_at', since)
        .order('id')
        .range(from, to),
    ),
    supabase.from('branches').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('company_id', 'is', null)
      .eq('status', 'ativo'),
    supabase
      .from('occurrences')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '("encerrada","cancelada","descartada")')
      .lt('due_at', now),
  ])

  // ------------------------------------------------------------ receita --
  const inPortfolio = rows.filter((r) => r.group !== 'out')
  const paying = inPortfolio.filter((r) => r.sub?.status === 'ativa' && Number(r.sub.contracted_price) > 0)
  // Receita recorrente contratada: o que as assinaturas ativas valem por mês.
  // Avaliações ainda não contam — não há compromisso firmado.
  const mrr = paying.reduce((sum, r) => sum + Number(r.sub!.contracted_price), 0)

  const revenue = byMonth(months, invoices, (i) => i.paid_at, (i) => i.amount_cents / 100)
  const received = revenue.at(-1)!.value
  const previous = revenue.at(-2)!
  const receivedDelta =
    previous.value > 0
      ? {
          value: received - previous.value,
          label: `${Math.abs(Math.round(((received - previous.value) / previous.value) * 100))}% vs ${previous.label}`,
        }
      : received > 0
        ? { value: 1, label: `sem recebimentos em ${previous.label}` }
        : null

  // ----------------------------------------------------------- carteira --
  const newCompanies = byMonth(months, rows.map((r) => r.company), (c) => c.created_at)
  const newThisMonth = newCompanies.at(-1)!.value
  const groupCount = (g: PortfolioRow['group']) => rows.filter((r) => r.group === g).length
  const needsAttention = groupCount('attention') + groupCount('blocked')

  const slices: PortfolioSlice[] = [
    { key: 'ok', label: 'Em dia', count: groupCount('ok'), hint: 'pagamento confirmado' },
    { key: 'trial', label: 'Em avaliação', count: groupCount('trial'), hint: 'teste gratuito em andamento' },
    { key: 'attention', label: 'Precisam de cobrança', count: groupCount('attention'), hint: 'vencidas ou em tolerância' },
    { key: 'blocked', label: 'Bloqueadas', count: groupCount('blocked'), hint: 'painel do cliente fechado' },
  ]

  // ---------------------------------------------------------- atividade --
  const occurrencesByMonth = byMonth(months, occurrences, (o) => o.opened_at)
  const cutoff30 = new Date(now).getTime() - 30 * DAY
  const recent = countByCompany(occurrences.filter((o) => new Date(o.opened_at).getTime() >= cutoff30))
  const names = new Map(rows.map((r) => [r.company.id, r.company.trade_name ?? r.company.legal_name]))
  const mostActive = [...recent.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, total]) => ({ rotulo: names.get(id) ?? 'Empresa removida', total }))

  // -------------------------------------------------------------- planos --
  const planRows = (plans.data ?? []).map((plan) => {
    const members = inPortfolio.filter((r) => r.sub?.plans?.slug === plan.slug)
    const planMrr = members
      .filter((r) => r.sub?.status === 'ativa')
      .reduce((sum, r) => sum + Number(r.sub!.contracted_price), 0)
    return { ...plan, companies: members.length, mrr: planMrr }
  })
  const maxPlan = Math.max(1, ...planRows.map((p) => p.companies))

  const queue = attentionQueue(rows)
  const today = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Visão geral"
        description={`Saúde financeira e uso da plataforma · ${today}`}
        action={
          <Link
            href="/master/empresas"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
          >
            Ver todas as empresas <Icon name="arrow-right" size={14} />
          </Link>
        }
      />

      {/* ------------------------------------------------ indicadores */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Receita recorrente (MRR)"
          value={formatMoney(mrr)}
          hint={`${paying.length} ${paying.length === 1 ? 'cliente pagante' : 'clientes pagantes'} · ${formatMoney(mrr * 12)}/ano`}
          icon={<Icon name="chart-column" size={16} />}
        />
        <KpiCard
          label={`Recebido em ${months.at(-1)!.label}`}
          value={formatMoney(received)}
          delta={receivedDelta}
          hint={receivedDelta ? undefined : 'nenhum pagamento registrado no mês'}
          icon={<Icon name="file-check-corner" size={16} />}
        />
        <KpiCard
          label="Empresas na carteira"
          value={inPortfolio.length}
          delta={newThisMonth ? { value: newThisMonth, label: `${newThisMonth} ${newThisMonth === 1 ? 'nova' : 'novas'} este mês` } : null}
          hint={newThisMonth ? undefined : 'nenhum cadastro novo este mês'}
          icon={<Icon name="building-2" size={16} />}
        />
        <KpiCard
          label="Precisam de atenção"
          value={needsAttention}
          tone={groupCount('blocked') ? 'danger' : needsAttention ? 'warn' : undefined}
          hint={needsAttention ? 'cobrança pendente ou bloqueio' : 'nenhuma pendência de cobrança'}
          icon={<Icon name={needsAttention ? 'shield-alert' : 'shield-check'} size={16} />}
        />
      </div>

      {/* ------------------------------------- fila de ação + carteira */}
      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <AttentionQueue items={queue} className="lg:col-span-2" />
        <PortfolioBar slices={slices} outside={groupCount('out')} />
      </div>

      {/* ------------------------------------------------- evolução */}
      <div className="grid gap-5 lg:grid-cols-2">
        <MonthlyBars
          title="Receita recebida por mês"
          description="Pagamentos confirmados, pela data em que entraram."
          data={revenue}
          money
        />
        <MonthlyBars
          title="Novas empresas por mês"
          description="Cadastros feitos pelo site."
          data={newCompanies}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <MonthlyBars
          title="Manifestações por mês"
          description="Relatos recebidos por todas as empresas."
          data={occurrencesByMonth}
          footer={
            late.count ? (
              <span className="text-danger">
                <strong className="tabular-nums">{late.count}</strong>{' '}
                {late.count === 1 ? 'manifestação está' : 'manifestações estão'} com o prazo vencido, somando todas as empresas.
              </span>
            ) : (
              'Nenhuma manifestação com prazo vencido.'
            )
          }
        />
        <BarList
          title="Empresas mais ativas"
          description="Manifestações recebidas nos últimos 30 dias."
          data={mostActive}
          empty="Nenhuma manifestação nos últimos 30 dias."
        />
      </div>

      {/* ------------------------------------------------ planos e uso */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Planos" description="Quantas empresas há em cada plano e quanto cada um soma por mês." />
          <ul className="flex flex-col divide-y divide-border">
            {planRows.map((plan) => (
              <li key={plan.slug} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3 sm:grid-cols-[10rem_minmax(0,1fr)_7rem]">
                <div>
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-[11px] text-muted">
                    {plan.self_service ? `${formatMoney(plan.monthly_price)}/mês` : 'valor negociado'}
                  </p>
                </div>
                <div className="order-last col-span-2 flex items-center gap-3 sm:order-none sm:col-span-1">
                  <div className="h-1.5 flex-1 rounded-full bg-chart-grid">
                    <div
                      className="h-1.5 rounded-r-full bg-chart"
                      style={{ width: plan.companies ? `${Math.max(3, (plan.companies / maxPlan) * 100)}%` : 0 }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-xs tabular-nums text-muted">
                    <span className="font-medium text-foreground">{plan.companies}</span>{' '}
                    {plan.companies === 1 ? 'empresa' : 'empresas'}
                  </span>
                </div>
                <p className="text-right text-sm font-medium tabular-nums">
                  {formatMoney(plan.mrr)}
                  <span className="block text-[11px] font-normal text-muted">por mês</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid grid-cols-2 gap-3 self-start">
          <StatTile label="Filiais ativas" value={branches.count ?? 0} />
          <StatTile label="Usuários de clientes" value={users.count ?? 0} />
          <StatTile label="Manifestações (6 meses)" value={occurrences.length} />
          <StatTile
            label="Prazos vencidos"
            value={late.count ?? 0}
            tone={late.count ? 'danger' : undefined}
          />
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------ fila de atenção ----

type QueueItem = {
  row: PortfolioRow
  priority: number
  action: string
}

/**
 * O que o administrador precisa resolver, na ordem em que deve resolver:
 * primeiro quem está com o painel fechado (o cliente já sente), depois
 * cobranças vencidas, por fim avaliações que terminam nesta semana — a hora
 * de oferecer o plano.
 */
function attentionQueue(rows: PortfolioRow[]): QueueItem[] {
  const items: QueueItem[] = []
  for (const row of rows) {
    const { situation, sub, group } = row
    if (group === 'blocked') {
      const action =
        situation.label === 'Avaliação vencida'
          ? 'Registrar o primeiro pagamento ou estender a avaliação'
          : situation.label === 'Inadimplente'
            ? 'Registrar o pagamento para liberar o painel'
            : 'Revisar o bloqueio'
      items.push({ row, priority: 0, action })
    } else if (group === 'attention') {
      const action =
        situation.label === 'Vencida'
          ? 'Cobrar ou marcar como inadimplente'
          : 'Cobrar antes do fim da tolerância'
      items.push({ row, priority: 1, action })
    } else if (group === 'trial' && sub?.trial_ends_at) {
      const days = Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / DAY)
      if (days <= 7) {
        items.push({
          row,
          priority: 2,
          action: `Avaliação termina ${days <= 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`} — oferecer o plano`,
        })
      }
    }
  }
  return items.sort((a, b) => a.priority - b.priority)
}

function AttentionQueue({ items, className }: { items: QueueItem[]; className?: string }) {
  const shown = items.slice(0, 8)
  return (
    <Card className={className}>
      <CardHeader
        title="Precisa de você"
        description="Empresas que pedem uma ação agora, da mais urgente para a menos."
        action={
          items.length ? (
            <span className="text-xs text-muted">
              <span className="font-medium text-foreground tabular-nums">{items.length}</span>{' '}
              {items.length === 1 ? 'pendência' : 'pendências'}
            </span>
          ) : null
        }
      />
      {!shown.length ? (
        <div className="flex items-center gap-3 px-5 py-8">
          <span aria-hidden className="grid size-9 place-items-center rounded-full bg-ok-soft text-ok">
            <Icon name="check" size={18} />
          </span>
          <div>
            <p className="text-sm font-medium">Tudo em dia</p>
            <p className="text-xs text-muted">Nenhuma cobrança pendente nem avaliação terminando esta semana.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map(({ row, action }) => {
            const { company, situation } = row
            const wa = whatsappLink(company.whatsapp ?? company.contact_phone ?? company.phone)
            return (
              <li key={company.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/master/empresas/${company.id}`}
                      className="truncate text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {company.trade_name ?? company.legal_name}
                    </Link>
                    <Badge tone={situation.tone}>{situation.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {action}
                    {situation.detail ? ` · ${situation.detail}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-muted"
                      title={company.contact_name ? `Falar com ${company.contact_name}` : 'Falar pelo WhatsApp'}
                    >
                      <Icon name="message-circle" size={14} /> WhatsApp
                    </a>
                  ) : null}
                  <Link
                    href={`/master/empresas/${company.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
                  >
                    Resolver <Icon name="arrow-right" size={14} />
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {items.length > shown.length ? (
        <div className="border-t border-border px-5 py-3 text-xs">
          <Link href="/master/empresas?situacao=atencao" className="font-medium text-accent underline-offset-4 hover:underline">
            Ver empresas que precisam de atenção →
          </Link>
        </div>
      ) : null}
    </Card>
  )
}

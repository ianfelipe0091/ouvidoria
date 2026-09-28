import Link from 'next/link'

import { StatTile } from '@/components/charts'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import { formatLimit, formatMoney } from '@/lib/brand'
import { requirePlatformAdmin } from '@/lib/auth'
import { billingSituation } from '@/lib/billing-situation'
import { formatDate } from '@/lib/domain'

export default async function MasterPage(props: PageProps<'/master'>) {
  const params = await props.searchParams
  const deleted = typeof params.excluida === 'string' ? params.excluida : null
  const { supabase } = await requirePlatformAdmin()

  /* O platform_admin atravessa o RLS por policy, então estas consultas somam
     todos os tenants — é o único perfil para o qual isso vale. */
  const [companies, subscriptions, plans, branches, users, occurrences, lateOccurrences] =
    await Promise.all([
      supabase
        .from('companies')
        .select('id, slug, legal_name, trade_name, tax_id, status, created_at, onboarded_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('subscriptions')
        .select('company_id, status, contracted_price, trial_ends_at, current_period_end, grace_until, plans(slug, name, self_service, max_branches, max_users)'),
      supabase.from('plans').select('slug, name').eq('is_active', true).order('sort_order'),
      supabase.from('branches').select('company_id').eq('status', 'ativo'),
      supabase.from('profiles').select('company_id').not('company_id', 'is', null).eq('status', 'ativo'),
      supabase.from('occurrences').select('company_id'),
      supabase
        .from('occurrences')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '("encerrada","cancelada","descartada")')
        .lt('due_at', new Date().toISOString()),
    ])

  const list = companies.data ?? []
  const subs = new Map((subscriptions.data ?? []).map((s) => [s.company_id, s]))
  const countBy = (rows: Array<{ company_id: string | null }> | null, id: string) =>
    (rows ?? []).filter((r) => r.company_id === id).length

  const rows = list.map((company) => {
    const sub = subs.get(company.id) ?? null
    return { company, sub, situation: billingSituation({ companyStatus: company.status, subscription: sub }) }
  })

  // Receita recorrente contratada: soma do que as assinaturas ativas valem por
  // mês. Empresas em avaliação ainda não contam — não há compromisso firmado.
  const mrr = (subscriptions.data ?? [])
    .filter((s) => s.status === 'ativa')
    .reduce((sum, s) => sum + Number(s.contracted_price), 0)
  const trials = (subscriptions.data ?? []).filter((s) => s.status === 'trial').length
  // O que pede ação do administrador: vencidas, inadimplentes, bloqueadas.
  const attention = rows.filter((r) => ['warn', 'danger'].includes(r.situation.tone)).length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Empresas clientes"
        description="Visão consolidada da plataforma: contas, planos, pagamentos e uso."
      />

      {deleted ? (
        <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
          Empresa <strong>{deleted}</strong> excluída definitivamente.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Empresas cadastradas" value={list.length} />
        <StatTile label="Em avaliação" value={trials} hint="ainda sem pagamento" />
        <StatTile
          label="Precisam de atenção"
          value={attention}
          tone={attention ? 'danger' : undefined}
          hint="vencidas, inadimplentes ou bloqueadas"
        />
        <StatTile
          label="Receita recorrente"
          value={formatMoney(mrr)}
          hint="soma das assinaturas ativas"
        />
        <StatTile label="Filiais" value={(branches.data ?? []).length} />
        <StatTile label="Usuários de clientes" value={(users.data ?? []).length} />
        <StatTile label="Manifestações" value={(occurrences.data ?? []).length} />
        <StatTile
          label="Manifestações em atraso"
          value={lateOccurrences.count ?? 0}
          tone={lateOccurrences.count ? 'danger' : undefined}
          hint="somando todas as empresas"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Contas"
          description="Clique numa empresa para editar dados, registrar pagamentos, bloquear ou excluir."
        />
        {!rows.length ? (
          <EmptyState
            title="Nenhuma empresa cadastrada"
            description="As contas aparecem aqui assim que alguém se cadastra pelo site."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Empresa</th>
                  <th scope="col" className="px-4 py-3 font-medium">Plano</th>
                  <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                  <th scope="col" className="px-4 py-3 font-medium">Filiais</th>
                  <th scope="col" className="px-4 py-3 font-medium">Usuários</th>
                  <th scope="col" className="px-4 py-3 font-medium">Manif.</th>
                  <th scope="col" className="px-4 py-3 font-medium">Desde</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ company, sub, situation }) => {
                  const plan = sub?.plans
                  const negotiated = plan && !plan.self_service && Number(sub?.contracted_price ?? 0) === 0
                  return (
                    <tr key={company.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/master/empresas/${company.id}`}
                          className="block font-medium underline-offset-4 hover:underline"
                        >
                          {company.trade_name ?? company.legal_name}
                        </Link>
                        <a
                          href={`/${company.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[11px] text-muted underline-offset-4 hover:underline"
                        >
                          /{company.slug}
                        </a>
                        {!company.onboarded_at ? (
                          <span className="text-[11px] text-warn">configuração pendente</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {plan?.name ?? '—'}
                        {sub ? (
                          <span className="block text-[11px] text-muted">
                            {negotiated ? 'valor a definir' : `${formatMoney(sub.contracted_price)}/mês`}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={situation.tone}>{situation.label}</Badge>
                        {situation.detail ? (
                          <span className="mt-0.5 block text-[11px] text-muted">{situation.detail}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        {formatLimit(countBy(branches.data, company.id), plan?.max_branches ?? null)}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        {formatLimit(countBy(users.data, company.id), plan?.max_users ?? null)}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        {countBy(occurrences.data, company.id)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{formatDate(company.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/master/empresas/${company.id}`}
                          className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                        >
                          Gerenciar →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Planos" description="Catálogo vigente e quantas empresas há em cada um." />
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-4">
          {(plans.data ?? []).map((plan) => {
            const count = (subscriptions.data ?? []).filter((s) => s.plans?.slug === plan.slug).length
            return (
              <div key={plan.slug} className="rounded-lg bg-surface-muted px-3 py-2">
                <p className="text-sm font-medium">{plan.name}</p>
                <p className="text-xs text-muted">
                  {count} {count === 1 ? 'empresa' : 'empresas'}
                </p>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

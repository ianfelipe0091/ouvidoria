import { StatTile } from '@/components/charts'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import {
  COMPANY_STATUS_LABEL, COMPANY_STATUS_TONE, SUBSCRIPTION_LABEL, SUBSCRIPTION_TONE,
  formatLimit, formatMoney,
} from '@/lib/brand'
import { requirePlatformAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/domain'
import { CompanyActions } from './client'

export default async function MasterPage() {
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
        .select('company_id, status, contracted_price, trial_ends_at, current_period_end, plans(slug, name, max_branches, max_users)'),
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

  const active = list.filter((c) => c.status === 'ativa')
  // Receita recorrente contratada: soma do que as assinaturas ativas valem por
  // mês. Empresas em avaliação ainda não contam — não há compromisso firmado.
  const mrr = (subscriptions.data ?? [])
    .filter((s) => s.status === 'ativa')
    .reduce((sum, s) => sum + Number(s.contracted_price), 0)
  const trials = (subscriptions.data ?? []).filter((s) => s.status === 'trial').length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Empresas clientes"
        description="Visão consolidada da plataforma: contas, planos, assinaturas e uso."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Empresas cadastradas" value={list.length} />
        <StatTile label="Empresas ativas" value={active.length} />
        <StatTile label="Em avaliação" value={trials} hint="ainda sem assinatura firmada" />
        <StatTile
          label="Receita recorrente"
          value={formatMoney(mrr)}
          hint="soma das assinaturas ativas"
        />
        <StatTile label="Filiais" value={(branches.data ?? []).length} />
        <StatTile label="Usuários de clientes" value={(users.data ?? []).length} />
        <StatTile label="Manifestações" value={(occurrences.data ?? []).length} />
        <StatTile
          label="Em atraso"
          value={lateOccurrences.count ?? 0}
          tone={lateOccurrences.count ? 'danger' : undefined}
          hint="somando todas as empresas"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Contas"
          description="Plano, assinatura e uso de cada cliente."
        />
        {!list.length ? (
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
                  <th scope="col" className="px-4 py-3 font-medium">Canal</th>
                  <th scope="col" className="px-4 py-3 font-medium">Plano</th>
                  <th scope="col" className="px-4 py-3 font-medium">Assinatura</th>
                  <th scope="col" className="px-4 py-3 font-medium">Filiais</th>
                  <th scope="col" className="px-4 py-3 font-medium">Usuários</th>
                  <th scope="col" className="px-4 py-3 font-medium">Manif.</th>
                  <th scope="col" className="px-4 py-3 font-medium">Desde</th>
                  <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.map((company) => {
                  const sub = subs.get(company.id)
                  const plan = sub?.plans
                  return (
                    <tr key={company.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <span className="block">{company.trade_name ?? company.legal_name}</span>
                        <span className="block font-mono text-[11px] text-muted">{company.tax_id}</span>
                        {!company.onboarded_at ? (
                          <span className="text-[11px] text-warn">configuração pendente</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <a href={`/ouvidoria/${company.slug}`} className="underline underline-offset-4">
                          /{company.slug}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {plan?.name ?? '—'}
                        {sub ? (
                          <span className="block text-[11px] text-muted">
                            {formatMoney(sub.contracted_price)}/mês
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {sub ? (
                          <Badge tone={SUBSCRIPTION_TONE[sub.status]}>
                            {SUBSCRIPTION_LABEL[sub.status]}
                          </Badge>
                        ) : '—'}
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
                      <td className="px-4 py-3">
                        <Badge tone={COMPANY_STATUS_TONE[company.status]}>
                          {COMPANY_STATUS_LABEL[company.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {plan ? (
                          <CompanyActions
                            companyId={company.id}
                            status={company.status}
                            planSlug={plan.slug}
                            plans={plans.data ?? []}
                          />
                        ) : null}
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
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
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

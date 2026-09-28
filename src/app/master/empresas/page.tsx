import { PageHeader } from '@/components/ui'
import { requirePlatformAdmin } from '@/lib/auth'
import { formatLimit, formatMoney } from '@/lib/brand'
import { formatDate } from '@/lib/domain'
import { countByCompany, fetchAll, loadPortfolio } from '../data'
import { CompanyTable, type CompanyListRow } from './table'

export default async function MasterCompaniesPage(props: PageProps<'/master/empresas'>) {
  const params = await props.searchParams
  const deleted = typeof params.excluida === 'string' ? params.excluida : null
  const initialFilter = typeof params.situacao === 'string' ? params.situacao : null
  const { supabase } = await requirePlatformAdmin()
  const now = new Date().toISOString()

  const [rows, plans, branches, users, occurrences, late] = await Promise.all([
    loadPortfolio(supabase),
    supabase.from('plans').select('slug, name').eq('is_active', true).order('sort_order'),
    fetchAll((from, to) =>
      supabase.from('branches').select('company_id').eq('status', 'ativo').order('id').range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from('profiles')
        .select('company_id')
        .not('company_id', 'is', null)
        .eq('status', 'ativo')
        .order('id')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from('occurrences').select('company_id').order('id').range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from('occurrences')
        .select('company_id')
        .not('status', 'in', '("encerrada","cancelada","descartada")')
        .lt('due_at', now)
        .order('id')
        .range(from, to),
    ),
  ])

  const branchCount = countByCompany(branches)
  const userCount = countByCompany(users)
  const occurrenceCount = countByCompany(occurrences)
  const lateCount = countByCompany(late)

  const list: CompanyListRow[] = rows.map(({ company, sub, situation, group }) => {
    const plan = sub?.plans ?? null
    const price = Number(sub?.contracted_price ?? 0)
    const negotiated = plan ? !plan.self_service && price === 0 : false
    return {
      id: company.id,
      slug: company.slug,
      name: company.trade_name ?? company.legal_name,
      legalName: company.legal_name,
      taxId: company.tax_id,
      planSlug: plan?.slug ?? null,
      planName: plan?.name ?? '—',
      price: sub?.status === 'ativa' ? price : 0,
      priceLabel: sub ? (negotiated ? 'valor a definir' : `${formatMoney(price)}/mês`) : null,
      situation: { label: situation.label, tone: situation.tone, detail: situation.detail },
      group,
      branches: formatLimit(branchCount.get(company.id) ?? 0, plan?.max_branches ?? null),
      users: formatLimit(userCount.get(company.id) ?? 0, plan?.max_users ?? null),
      occurrences: occurrenceCount.get(company.id) ?? 0,
      late: lateCount.get(company.id) ?? 0,
      createdAt: company.created_at,
      createdLabel: formatDate(company.created_at),
      onboarded: Boolean(company.onboarded_at),
    }
  })

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Empresas"
        description="Todas as contas da plataforma. Clique numa empresa para editar dados, registrar pagamentos, bloquear ou excluir."
      />

      {deleted ? (
        <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
          Empresa <strong>{deleted}</strong> excluída definitivamente.
        </p>
      ) : null}

      <CompanyTable rows={list} plans={plans.data ?? []} initialFilter={initialFilter} />
    </div>
  )
}

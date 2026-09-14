import Link from 'next/link'

import { Badge, Card, EmptyState, PageHeader, StatusDot } from '@/components/ui'
import { requireProfile } from '@/lib/auth'
import {
  STATUS_LABEL, STATUS_TONE, formatDate, formatDeadline, slaState,
} from '@/lib/domain'
import { applyFilters, loadFilterOptions } from '@/lib/occurrence-query'
import { OccurrenceFilters } from './filters'

const PAGE_SIZE = 25

export default async function OccurrencesPage(props: PageProps<'/painel/ocorrencias'>) {
  const filters = await props.searchParams
  const { profile, supabase } = await requireProfile()

  const { data: settings } = profile.company_id
    ? await supabase
        .from('company_settings')
        .select('sla_warning_days')
        .eq('company_id', profile.company_id)
        .maybeSingle()
    : { data: null }
  const warningDays = settings?.sla_warning_days ?? 2

  const page = Math.max(1, Number(filters.pagina) || 1)
  const from = (page - 1) * PAGE_SIZE

  const base = supabase
    .from('occurrences')
    .select(
      `id, protocol, status, opened_at, due_at, is_anonymous,
       occurrence_types(name), categories(name), branches(name), profiles(full_name)`,
      { count: 'exact' },
    )
    .order('opened_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  const { data, count, error } = await applyFilters<typeof base>(
    base, filters, warningDays,
  )

  const options = await loadFilterOptions(supabase)
  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ocorrências"
        description={
          total === 1 ? '1 manifestação encontrada' : `${total} manifestações encontradas`
        }
      />

      <OccurrenceFilters options={options} />

      <Card className="overflow-hidden">
        {error ? (
          <EmptyState title="Não foi possível carregar as ocorrências" description={error.message} />
        ) : !data?.length ? (
          <EmptyState
            title="Nenhuma manifestação encontrada"
            description="Ajuste os filtros ou aguarde novos registros pelo canal público."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Protocolo</th>
                  <th scope="col" className="px-4 py-3 font-medium">Data</th>
                  <th scope="col" className="px-4 py-3 font-medium">Tipo</th>
                  <th scope="col" className="px-4 py-3 font-medium">Filial</th>
                  <th scope="col" className="px-4 py-3 font-medium">Categoria</th>
                  <th scope="col" className="px-4 py-3 font-medium">Responsável</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const sla = slaState(row.status, row.due_at, warningDays)
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                      <td className="px-4 py-3">
                        <Link
                          href={`/painel/ocorrencias/${row.id}`}
                          className="font-mono text-xs font-medium whitespace-nowrap underline-offset-4 hover:underline"
                        >
                          {row.protocol}
                        </Link>
                        {row.is_anonymous ? (
                          <span className="ml-2 text-[11px] text-muted">anônima</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{formatDate(row.opened_at)}</td>
                      <td className="px-4 py-3 text-xs">{row.occurrence_types?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">{row.branches?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">{row.categories?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">{row.profiles?.full_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[row.status]}>
                          <StatusDot tone={STATUS_TONE[row.status]} />
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            sla === 'em_atraso'
                              ? 'text-xs font-medium text-danger'
                              : sla === 'proximo_vencimento'
                                ? 'text-xs font-medium text-warn'
                                : 'text-xs text-muted'
                          }
                        >
                          {sla === 'concluida' ? '—' : formatDeadline(row.due_at)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 ? (
        <Pagination page={page} pages={pages} filters={filters} />
      ) : null}
    </div>
  )
}

function Pagination({
  page, pages, filters,
}: {
  page: number
  pages: number
  filters: Record<string, string | string[] | undefined>
}) {
  const link = (target: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'string' && value && key !== 'pagina') params.set(key, value)
    }
    params.set('pagina', String(target))
    return `/painel/ocorrencias?${params}`
  }

  return (
    <nav className="flex items-center justify-between gap-3 text-xs" aria-label="Paginação">
      {page > 1 ? (
        <Link href={link(page - 1)} className="underline underline-offset-4">Anterior</Link>
      ) : <span />}
      <span className="text-muted">Página {page} de {pages}</span>
      {page < pages ? (
        <Link href={link(page + 1)} className="underline underline-offset-4">Próxima</Link>
      ) : <span />}
    </nav>
  )
}

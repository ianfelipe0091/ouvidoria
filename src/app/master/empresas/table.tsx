'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { Badge, Card, EmptyState, Input, Select, cn } from '@/components/ui'
import type { SituationGroup } from '@/lib/billing-situation'

export type CompanyListRow = {
  id: string
  slug: string
  name: string
  legalName: string
  taxId: string
  planSlug: string | null
  planName: string
  /** Mensalidade que conta na receita (só assinaturas ativas). */
  price: number
  priceLabel: string | null
  situation: { label: string; tone: 'neutral' | 'info' | 'warn' | 'ok' | 'danger' | 'accent'; detail: string | null }
  group: SituationGroup
  branches: string
  users: string
  occurrences: number
  late: number
  createdAt: string
  createdLabel: string
  onboarded: boolean
}

const FILTERS: Array<{ key: string; label: string; match: (g: SituationGroup) => boolean }> = [
  { key: 'todas', label: 'Todas', match: () => true },
  { key: 'atencao', label: 'Precisam de atenção', match: (g) => g === 'attention' || g === 'blocked' },
  { key: 'em-dia', label: 'Em dia', match: (g) => g === 'ok' },
  { key: 'avaliacao', label: 'Em avaliação', match: (g) => g === 'trial' },
  { key: 'canceladas', label: 'Canceladas', match: (g) => g === 'out' },
]

const SORTS = {
  recentes: { label: 'Mais recentes', fn: (a: CompanyListRow, b: CompanyListRow) => b.createdAt.localeCompare(a.createdAt) },
  nome: { label: 'Nome (A–Z)', fn: (a: CompanyListRow, b: CompanyListRow) => a.name.localeCompare(b.name, 'pt-BR') },
  valor: { label: 'Maior mensalidade', fn: (a: CompanyListRow, b: CompanyListRow) => b.price - a.price },
  uso: { label: 'Mais manifestações', fn: (a: CompanyListRow, b: CompanyListRow) => b.occurrences - a.occurrences },
} as const

/** Tira acentos e caixa: "São" encontra "sao". */
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Lista filtrável. Tudo acontece no navegador: a carteira cabe inteira na
 * página, e filtrar sem ida ao servidor responde na hora da digitação.
 */
export function CompanyTable({
  rows, plans, initialFilter,
}: {
  rows: CompanyListRow[]
  plans: Array<{ slug: string; name: string }>
  initialFilter: string | null
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(
    FILTERS.some((f) => f.key === initialFilter) ? initialFilter! : 'todas',
  )
  const [plan, setPlan] = useState('')
  const [sort, setSort] = useState<keyof typeof SORTS>('recentes')

  const chooseFilter = (key: string) => {
    setFilter(key)
    // Mantém o filtro no endereço, para poder compartilhar ou voltar a ele.
    const url = new URL(window.location.href)
    url.searchParams.delete('excluida')
    if (key === 'todas') url.searchParams.delete('situacao')
    else url.searchParams.set('situacao', key)
    window.history.replaceState(null, '', url)
  }

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => f.match(r.group)).length])),
    [rows],
  )

  const visible = useMemo(() => {
    const q = norm(query.trim())
    const qDigits = query.replace(/\D/g, '')
    const match = FILTERS.find((f) => f.key === filter)!.match
    return rows
      .filter((r) => match(r.group))
      .filter((r) => !plan || r.planSlug === plan)
      .filter((r) => {
        if (!q) return true
        return (
          norm(r.name).includes(q) ||
          norm(r.legalName).includes(q) ||
          r.slug.includes(q) ||
          (qDigits.length >= 3 && r.taxId.includes(qDigits))
        )
      })
      .sort(SORTS[sort].fn)
  }, [rows, query, filter, plan, sort])

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <label htmlFor="busca-empresa" className="sr-only">Buscar empresa</label>
            <Input
              id="busca-empresa"
              type="search"
              placeholder="Buscar por nome, razão social, endereço do canal ou CNPJ"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <label className="sr-only" htmlFor="filtro-plano">Plano</label>
          <Select id="filtro-plano" value={plan} onChange={(e) => setPlan(e.target.value)} className="w-auto!">
            <option value="">Todos os planos</option>
            {plans.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="ordem">Ordenar por</label>
          <Select
            id="ordem"
            value={sort}
            onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}
            className="w-auto!"
          >
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </Select>
        </div>

        <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = f.key === filter
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => chooseFilter(f.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                  active
                    ? 'border-accent bg-accent-soft font-medium text-accent'
                    : 'border-border text-muted hover:bg-surface-muted hover:text-foreground',
                )}
              >
                {f.label}
                <span className="tabular-nums opacity-70">{counts[f.key]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {!rows.length ? (
        <EmptyState
          title="Nenhuma empresa cadastrada"
          description="As contas aparecem aqui assim que alguém se cadastra pelo site."
        />
      ) : !visible.length ? (
        <EmptyState
          title="Nenhuma empresa encontrada"
          description="Ajuste a busca ou os filtros para ver outras empresas."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted/50 text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Empresa</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Situação</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Plano</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Filiais</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Usuários</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Manifestações</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Desde</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/master/empresas/${r.id}`}
                      className="block font-medium underline-offset-4 hover:underline"
                    >
                      {r.name}
                    </Link>
                    <a
                      href={`/${r.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[11px] text-muted underline-offset-4 hover:underline"
                    >
                      /{r.slug}
                    </a>
                    {!r.onboarded ? (
                      <span className="text-[11px] text-warn">configuração pendente</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={r.situation.tone}>{r.situation.label}</Badge>
                    {r.situation.detail ? (
                      <span className="mt-0.5 block text-[11px] text-muted">{r.situation.detail}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.planName}
                    {r.priceLabel ? <span className="block text-[11px] text-muted">{r.priceLabel}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">{r.branches}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">{r.users}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">
                    {r.occurrences}
                    {r.late ? (
                      <span className="block text-[11px] text-danger">{r.late} em atraso</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-muted">{r.createdLabel}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/master/empresas/${r.id}`}
                      className="text-xs font-medium whitespace-nowrap text-accent underline-offset-4 hover:underline"
                    >
                      Gerenciar →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length ? (
        <p className="border-t border-border px-5 py-2.5 text-xs text-muted">
          {visible.length === rows.length
            ? `${rows.length} ${rows.length === 1 ? 'empresa' : 'empresas'}`
            : `${visible.length} de ${rows.length} empresas`}
        </p>
      ) : null}
    </Card>
  )
}

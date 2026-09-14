'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

import { Button, Input, Select } from '@/components/ui'
import { STATUS_LABEL } from '@/lib/domain'

export type FilterOptions = {
  types: Array<{ id: string; name: string }>
  branches: Array<{ id: string; name: string }>
  categories: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
  assignees: Array<{ id: string; full_name: string }>
}

export function OccurrenceFilters({ options }: { options: FilterOptions }) {
  const router = useRouter()
  const params = useSearchParams()

  /* Os filtros vivem na URL: a busca filtrada fica compartilhável e o botão
     voltar do navegador funciona como se espera. */
  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params)
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete('pagina')
      router.push(`/painel/ocorrencias?${next}`)
    },
    [params, router],
  )

  const value = (key: string) => params.get(key) ?? ''
  const hasFilters = Array.from(params.keys()).some((k) => k !== 'pagina')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Input
          defaultValue={value('q')}
          onChange={(e) => setParam('q', e.target.value)}
          placeholder="Buscar por protocolo…"
          className="w-auto! min-w-48"
          aria-label="Buscar por protocolo"
        />

        <Select value={value('periodo')} onChange={(e) => setParam('periodo', e.target.value)} aria-label="Período" className="w-auto!">
          <option value="">Qualquer período</option>
          <option value="hoje">Hoje</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
          <option value="12m">Últimos 12 meses</option>
        </Select>

        <Select value={value('status')} onChange={(e) => setParam('status', e.target.value)} aria-label="Status" className="w-auto!">
          <option value="">Todos os status</option>
          <option value="abertas">Somente em aberto</option>
          {Object.entries(STATUS_LABEL).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>

        <Select value={value('prazo')} onChange={(e) => setParam('prazo', e.target.value)} aria-label="Prazo" className="w-auto!">
          <option value="">Qualquer prazo</option>
          <option value="no_prazo">No prazo</option>
          <option value="proximo_vencimento">Próximo do vencimento</option>
          <option value="em_atraso">Em atraso</option>
        </Select>

        {options.types.length ? (
          <Select value={value('tipo')} onChange={(e) => setParam('tipo', e.target.value)} aria-label="Tipo" className="w-auto!">
            <option value="">Todos os tipos</option>
            {options.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        ) : null}

        {options.branches.length ? (
          <Select value={value('filial')} onChange={(e) => setParam('filial', e.target.value)} aria-label="Filial" className="w-auto!">
            <option value="">Todas as filiais</option>
            {options.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        ) : null}

        {options.categories.length ? (
          <Select value={value('categoria')} onChange={(e) => setParam('categoria', e.target.value)} aria-label="Categoria" className="w-auto!">
            <option value="">Todas as categorias</option>
            {options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        ) : null}

        {options.departments.length ? (
          <Select value={value('departamento')} onChange={(e) => setParam('departamento', e.target.value)} aria-label="Departamento" className="w-auto!">
            <option value="">Todos os departamentos</option>
            {options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        ) : null}

        {options.assignees.length ? (
          <Select value={value('responsavel')} onChange={(e) => setParam('responsavel', e.target.value)} aria-label="Responsável" className="w-auto!">
            <option value="">Qualquer responsável</option>
            <option value="sem">Sem responsável</option>
            {options.assignees.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        ) : null}

        <Select value={value('manifestante')} onChange={(e) => setParam('manifestante', e.target.value)} aria-label="Manifestante" className="w-auto!">
          <option value="">Identificado e anônimo</option>
          <option value="identificado">Identificado</option>
          <option value="anonimo">Anônimo</option>
        </Select>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={() => router.push('/painel/ocorrencias')}>
            Limpar
          </Button>
        ) : null}
      </div>
    </div>
  )
}

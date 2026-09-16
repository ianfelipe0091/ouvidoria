'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

import { Button, Select } from '@/components/ui'

export type DashboardOptions = {
  states: Array<{ uf: string; filiais: number }>
  branches: Array<{ id: string; name: string; address_state: string | null }>
  types: Array<{ id: string; name: string }>
}

/**
 * Recorte do dashboard.
 *
 * Fica na URL, e não em estado local, por três motivos: o gestor consegue
 * mandar "o painel do Nordeste" para alguém, o botão voltar funciona, e a
 * página continua sendo renderizada no servidor com os números já filtrados.
 */
export function DashboardFilters({ options }: { options: DashboardOptions }) {
  const router = useRouter()
  const params = useSearchParams()

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params)
      if (value) next.set(key, value)
      else next.delete(key)
      // Trocar de estado invalida a loja escolhida, que pode ser de outro.
      if (key === 'estado') next.delete('loja')
      router.push(`/painel?${next}`)
    },
    [params, router],
  )

  const value = (key: string) => params.get(key) ?? ''
  const estado = value('estado')

  // Com um estado escolhido, a lista de lojas acompanha — oferecer lojas de
  // outros estados só geraria combinações que não retornam nada.
  const branches = estado
    ? options.branches.filter((b) => b.address_state === estado)
    : options.branches

  const hasFilters = ['estado', 'loja', 'tipo'].some((k) => params.get(k))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value('periodo') || '30'}
        onChange={(e) => setParam('periodo', e.target.value)}
        aria-label="Período"
        className="w-auto!"
      >
        <option value="7">Últimos 7 dias</option>
        <option value="30">Últimos 30 dias</option>
        <option value="90">Últimos 90 dias</option>
        <option value="365">Últimos 12 meses</option>
      </Select>

      {options.states.length ? (
        <Select
          value={estado}
          onChange={(e) => setParam('estado', e.target.value)}
          aria-label="Estado"
          className="w-auto!"
        >
          <option value="">Todos os estados</option>
          {options.states.map((s) => (
            <option key={s.uf} value={s.uf}>
              {s.uf} ({s.filiais})
            </option>
          ))}
        </Select>
      ) : null}

      {branches.length ? (
        <Select
          value={value('loja')}
          onChange={(e) => setParam('loja', e.target.value)}
          aria-label="Loja ou filial"
          className="w-auto!"
        >
          <option value="">Todas as lojas</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.address_state ? ` — ${b.address_state}` : ''}
            </option>
          ))}
        </Select>
      ) : null}

      {options.types.length ? (
        <Select
          value={value('tipo')}
          onChange={(e) => setParam('tipo', e.target.value)}
          aria-label="Tipo de manifestação"
          className="w-auto!"
        >
          <option value="">Todos os tipos</option>
          {options.types.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      ) : null}

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/painel?periodo=${value('periodo') || '30'}`)}
        >
          Limpar filtros
        </Button>
      ) : null}
    </div>
  )
}

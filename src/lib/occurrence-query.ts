import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { OPEN_STATUSES, type OccurrenceStatus } from '@/lib/domain'

export type Filters = Record<string, string | string[] | undefined>

const PERIODS: Record<string, number> = { hoje: 1, '7d': 7, '30d': 30, '90d': 90, '12m': 365 }

function one(value: string | string[] | undefined) {
  return typeof value === 'string' && value ? value : null
}

/**
 * Forma encadeável do builder do PostgREST.
 *
 * O builder real tipa cada método com os nomes de coluna da tabela, então não
 * dá para descrevê-lo de forma genérica sem reconstruir toda essa maquinaria.
 * Estreitamos para esta forma uma única vez, aplicamos os filtros e devolvemos
 * o tipo original — assim o `any` não escapa para o resto do código.
 */
type Chainable = {
  eq: (column: string, value: string | number | boolean) => Chainable
  in: (column: string, values: readonly string[]) => Chainable
  is: (column: string, value: null) => Chainable
  gt: (column: string, value: string) => Chainable
  gte: (column: string, value: string) => Chainable
  lt: (column: string, value: string) => Chainable
  lte: (column: string, value: string) => Chainable
  ilike: (column: string, pattern: string) => Chainable
}

/**
 * Traduz os filtros da URL numa query do PostgREST.
 *
 * Não há filtro por empresa em lugar nenhum: o RLS já restringe ao tenant do
 * usuário. Acrescentar `.eq('company_id', ...)` aqui daria a falsa impressão de
 * que é isso que garante o isolamento.
 */
export function applyFilters<Q>(
  original: Q,
  filters: Filters,
  warningDays: number,
): Q {
  let query = original as Chainable

  const status = one(filters.status)
  if (status === 'abertas') query = query.in('status', OPEN_STATUSES)
  else if (status) query = query.eq('status', status as OccurrenceStatus)

  const periodo = one(filters.periodo)
  if (periodo && PERIODS[periodo]) {
    const since = new Date(Date.now() - PERIODS[periodo] * 86_400_000).toISOString()
    query = query.gte('opened_at', since)
  }

  const prazo = one(filters.prazo)
  if (prazo) {
    const now = new Date()
    const warningEdge = new Date(now.getTime() + warningDays * 86_400_000).toISOString()
    // Prazo só faz sentido no que ainda está aberto.
    query = query.in('status', OPEN_STATUSES)
    if (prazo === 'em_atraso') query = query.lt('due_at', now.toISOString())
    else if (prazo === 'proximo_vencimento') {
      query = query.gte('due_at', now.toISOString()).lte('due_at', warningEdge)
    } else if (prazo === 'no_prazo') query = query.gt('due_at', warningEdge)
  }

  const tipo = one(filters.tipo)
  if (tipo) query = query.eq('type_id', tipo)

  const filial = one(filters.filial)
  if (filial) query = query.eq('branch_id', filial)

  const categoria = one(filters.categoria)
  if (categoria) query = query.eq('category_id', categoria)

  const departamento = one(filters.departamento)
  if (departamento) query = query.eq('department_id', departamento)

  const responsavel = one(filters.responsavel)
  if (responsavel === 'sem') query = query.is('assignee_id', null)
  else if (responsavel) query = query.eq('assignee_id', responsavel)

  const manifestante = one(filters.manifestante)
  if (manifestante === 'anonimo') query = query.eq('is_anonymous', true)
  else if (manifestante === 'identificado') query = query.eq('is_anonymous', false)

  const q = one(filters.q)
  if (q) query = query.ilike('protocol', `%${q}%`)

  return query as Q
}

/** Opções dos seletores de filtro, todas já restritas ao tenant pelo RLS. */
export async function loadFilterOptions(supabase: SupabaseClient<Database>) {
  const [types, branches, categories, departments, assignees] = await Promise.all([
    supabase.from('occurrence_types').select('id, name').eq('status', 'ativo').order('sort_order'),
    supabase.from('branches').select('id, name').eq('status', 'ativo').order('name'),
    supabase.from('categories').select('id, name').eq('status', 'ativo').order('sort_order'),
    supabase.from('departments').select('id, name').eq('status', 'ativo').order('name'),
    supabase.from('profiles').select('id, full_name').eq('status', 'ativo').order('full_name'),
  ])

  return {
    types: types.data ?? [],
    branches: branches.data ?? [],
    categories: categories.data ?? [],
    departments: departments.data ?? [],
    assignees: assignees.data ?? [],
  }
}

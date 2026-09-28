import 'server-only'

import type { requirePlatformAdmin } from '@/lib/auth'
import { billingSituation, situationGroup } from '@/lib/billing-situation'

/*
 * Dados do painel Master. O platform_admin atravessa o RLS por policy, então
 * estas consultas somam todos os tenants — é o único perfil para o qual isso
 * vale.
 */

type Supabase = Awaited<ReturnType<typeof requirePlatformAdmin>>['supabase']

const TZ = 'America/Sao_Paulo'
const PAGE = 1000

/**
 * Lê todas as linhas de uma consulta, em páginas. O PostgREST corta cada
 * resposta em 1.000 linhas; sem paginar, as contagens sairiam menores que a
 * realidade sem nenhum aviso assim que a plataforma passasse desse volume.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

// ----------------------------------------------------------------- meses ----

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-09" no fuso de Brasília — um pagamento às 22h de 30/09 é de setembro. */
export function monthKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' })
}

/** Os últimos `n` meses, do mais antigo ao atual, com o instante em que começam. */
export function lastMonths(n: number) {
  const [y, m] = monthKey(new Date().toISOString()).split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1))
    const month = d.getUTCMonth()
    const key = `${d.getUTCFullYear()}-${String(month + 1).padStart(2, '0')}`
    return { key, label: MONTH_SHORT[month], start: `${key}-01T00:00:00-03:00` }
  })
}

/** Soma `value(row)` por mês nas chaves dadas; meses sem linhas ficam em zero. */
export function byMonth<T>(
  months: Array<{ key: string; label: string }>,
  rows: T[],
  date: (row: T) => string | null,
  value: (row: T) => number = () => 1,
) {
  const totals = new Map(months.map((m) => [m.key, 0]))
  for (const row of rows) {
    const d = date(row)
    if (!d) continue
    const k = monthKey(d)
    if (totals.has(k)) totals.set(k, totals.get(k)! + value(row))
  }
  return months.map((m) => ({ key: m.key, label: m.label, value: totals.get(m.key) ?? 0 }))
}

// -------------------------------------------------------------- carteira ----

/** Empresas com assinatura e situação — a base das duas telas do Master. */
export async function loadPortfolio(supabase: Supabase) {
  const [companies, subscriptions] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from('companies')
        .select('id, slug, legal_name, trade_name, tax_id, status, created_at, onboarded_at, whatsapp, phone, contact_name, contact_phone')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from('subscriptions')
        .select('company_id, status, contracted_price, trial_ends_at, current_period_end, grace_until, plans(slug, name, self_service, max_branches, max_users)')
        .order('company_id')
        .range(from, to),
    ),
  ])

  const subs = new Map(subscriptions.map((s) => [s.company_id, s]))
  return companies.map((company) => {
    const sub = subs.get(company.id) ?? null
    const situation = billingSituation({ companyStatus: company.status, subscription: sub })
    return { company, sub, situation, group: situationGroup(situation) }
  })
}

export type PortfolioRow = Awaited<ReturnType<typeof loadPortfolio>>[number]

/** Conta linhas por empresa: { company_id → quantidade }. */
export function countByCompany(rows: Array<{ company_id: string | null }>) {
  const out = new Map<string, number>()
  for (const r of rows) {
    if (r.company_id) out.set(r.company_id, (out.get(r.company_id) ?? 0) + 1)
  }
  return out
}

/** Link de WhatsApp para o contato da empresa, quando há um número usável. */
export function whatsappLink(raw: string | null | undefined) {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (d.length < 10) return null
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`
}

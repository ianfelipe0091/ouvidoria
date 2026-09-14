import Link from 'next/link'

import { BarList, StatTile, TrendChart } from '@/components/charts'
import { PageHeader } from '@/components/ui'
import { requireProfile } from '@/lib/auth'
import { STATUS_LABEL, type OccurrenceStatus } from '@/lib/domain'
import { PeriodPicker } from './period'

type Summary = {
  total: number
  novas: number
  em_analise: number
  em_tratamento: number
  aguardando_resposta: number
  respondidas: number
  encerradas: number
  anonimas: number
  em_atraso: number
  tempo_medio_resposta: number | null
}

const PERIODS: Record<string, { days: number; label: string }> = {
  '7': { days: 7, label: 'últimos 7 dias' },
  '30': { days: 30, label: 'últimos 30 dias' },
  '90': { days: 90, label: 'últimos 90 dias' },
  '365': { days: 365, label: 'últimos 12 meses' },
}

export default async function DashboardPage(props: PageProps<'/painel'>) {
  const params = await props.searchParams
  const key = typeof params.periodo === 'string' && PERIODS[params.periodo] ? params.periodo : '30'
  const { days, label } = PERIODS[key]

  const { supabase } = await requireProfile()

  const [summary, series, porTipo, porFilial, porCategoria, porStatus] = await Promise.all([
    supabase.rpc('dashboard_summary', { p_days: days }),
    supabase.rpc('dashboard_timeseries', { p_days: days }),
    supabase.rpc('dashboard_breakdown', { p_dimension: 'tipo', p_days: days }),
    supabase.rpc('dashboard_breakdown', { p_dimension: 'filial', p_days: days }),
    supabase.rpc('dashboard_breakdown', { p_dimension: 'categoria', p_days: days }),
    supabase.rpc('dashboard_breakdown', { p_dimension: 'status', p_days: days }),
  ])

  const s = (summary.data as unknown as Summary) ?? null
  const statusData = (porStatus.data ?? []).map((row) => ({
    rotulo: STATUS_LABEL[row.rotulo as OccurrenceStatus] ?? row.rotulo,
    total: Number(row.total),
  }))

  const toChart = (rows: Array<{ rotulo: string; total: number }> | null) =>
    (rows ?? []).map((r) => ({ rotulo: r.rotulo, total: Number(r.total) }))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard"
        description={`Visão da operação nos ${label}.`}
        action={<PeriodPicker value={key} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total de manifestações" value={s?.total ?? 0} />
        <StatTile label="Novas" value={s?.novas ?? 0} hint="aguardando triagem" />
        <StatTile label="Em análise" value={(s?.em_analise ?? 0) + (s?.em_tratamento ?? 0)} />
        <StatTile
          label="Em atraso"
          value={s?.em_atraso ?? 0}
          tone={s?.em_atraso ? 'danger' : undefined}
          hint="prazo vencido e ainda aberta"
        />
        <StatTile label="Aguardando resposta" value={s?.aguardando_resposta ?? 0} />
        <StatTile label="Respondidas" value={s?.respondidas ?? 0} />
        <StatTile label="Encerradas" value={s?.encerradas ?? 0} />
        <StatTile
          label="Tempo médio de resposta"
          value={s?.tempo_medio_resposta != null ? `${s.tempo_medio_resposta} d` : '—'}
          hint="da abertura até a resposta"
        />
      </div>

      <TrendChart
        title="Manifestações por dia"
        description={`Registros nos ${label}.`}
        data={(series.data ?? []).map((r) => ({ dia: r.dia, total: Number(r.total) }))}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <BarList title="Por tipo" data={toChart(porTipo.data)} />
        <BarList title="Por status" data={statusData} />
        <BarList
          title="Por filial"
          description="Útil para comparar unidades."
          data={toChart(porFilial.data)}
        />
        <BarList
          title="Por categoria"
          description="Mostra quais assuntos mais aparecem."
          data={toChart(porCategoria.data)}
        />
      </div>

      <p className="text-xs text-muted">
        {s?.anonimas ?? 0} das {s?.total ?? 0} manifestações do período foram anônimas.{' '}
        <Link href="/painel/ocorrencias?manifestante=anonimo" className="underline underline-offset-4">
          Ver somente anônimas
        </Link>
      </p>
    </div>
  )
}

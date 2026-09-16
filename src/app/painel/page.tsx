import Link from 'next/link'

import { BarList, FlowChart, Gauge, SeverityDial, StatTile } from '@/components/charts'
import { PageHeader } from '@/components/ui'
import { requireProfile } from '@/lib/auth'
import {
  SEVERITY_LABEL, SEVERITY_ORDER, STATUS_LABEL,
  type OccurrenceStatus, type Severity,
} from '@/lib/domain'
import { DashboardFilters, type DashboardOptions } from './filters'

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

type Breakdown = { rotulo: string; total: number; severidade: string | null }

const PERIODS: Record<string, { days: number; label: string }> = {
  '7': { days: 7, label: 'últimos 7 dias' },
  '30': { days: 30, label: 'últimos 30 dias' },
  '90': { days: 90, label: 'últimos 90 dias' },
  '365': { days: 365, label: 'últimos 12 meses' },
}

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' && value ? value : null

export default async function DashboardPage(props: PageProps<'/painel'>) {
  const params = await props.searchParams
  const key = one(params.periodo) && PERIODS[one(params.periodo)!] ? one(params.periodo)! : '30'
  const { days, label } = PERIODS[key]

  const estado = one(params.estado)
  const loja = one(params.loja)
  const tipo = one(params.tipo)

  const { supabase } = await requireProfile()

  // O mesmo recorte vai para todas as consultas. Filtrar só parte da tela
  // produziria números que não fecham entre si.
  const filtros = {
    p_days: days,
    p_state: estado ?? undefined,
    p_branch_id: loja ?? undefined,
    p_type_id: tipo ?? undefined,
  }

  const [summary, porTipo, porFilial, porEstado, porCategoria, porStatus,
         states, branches, types, gauge, flow] = await Promise.all([
    supabase.rpc('dashboard_summary', filtros),
    supabase.rpc('dashboard_breakdown', { p_dimension: 'tipo', ...filtros }),
    supabase.rpc('dashboard_breakdown', { p_dimension: 'filial', ...filtros }),
    supabase.rpc('dashboard_breakdown', { p_dimension: 'estado', ...filtros }),
    supabase.rpc('dashboard_breakdown', { p_dimension: 'categoria', ...filtros }),
    supabase.rpc('dashboard_breakdown', { p_dimension: 'status', ...filtros }),
    supabase.rpc('company_states'),
    supabase.from('branches').select('id, name, address_state').eq('status', 'ativo').order('name'),
    supabase.from('occurrence_types').select('id, name').eq('status', 'ativo').order('sort_order'),
    supabase.rpc('dashboard_sla_gauge', filtros),
    supabase.rpc('dashboard_flow', filtros),
  ])

  const s = (summary.data as unknown as Summary) ?? null
  const tipos = (porTipo.data ?? []) as Breakdown[]
  const sla = gauge.data as unknown as {
    taxa: number | null; no_prazo: number; atrasadas: number; abertas_atrasadas: number; avaliadas: number
  } | null

  const toChart = (rows: Breakdown[] | null) =>
    (rows ?? []).map((r) => ({
      rotulo: r.rotulo,
      total: Number(r.total),
      severidade: (r.severidade as Severity | null) ?? null,
    }))

  // O anel agrupa os tipos por gravidade: é a leitura que o gestor faz primeiro
  // — quanto do volume é grave — antes de olhar tipo a tipo.
  const porGravidade = SEVERITY_ORDER.map((severidade) => ({
    severidade,
    rotulo: SEVERITY_LABEL[severidade],
    total: tipos
      .filter((t) => t.severidade === severidade)
      .reduce((soma, t) => soma + Number(t.total), 0),
  })).filter((item) => item.total > 0)

  const options: DashboardOptions = {
    states: (states.data ?? []).map((r) => ({ uf: r.uf, filiais: Number(r.filiais) })),
    branches: branches.data ?? [],
    types: types.data ?? [],
  }

  const recorte = [
    estado ? `estado ${estado}` : null,
    loja ? options.branches.find((b) => b.id === loja)?.name : null,
    tipo ? options.types.find((t) => t.id === tipo)?.name : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard"
        description={
          recorte.length
            ? `${label} · ${recorte.join(' · ')}`
            : `Visão da operação nos ${label}.`
        }
      />

      <DashboardFilters options={options} />

      <div className="grid gap-5 lg:grid-cols-3">
        <SeverityDial
          title="Total do período"
          description="Composição por gravidade do tipo."
          total={s?.total ?? 0}
          data={porGravidade}
          emptyLabel="Nenhuma manifestação neste recorte."
        />

        <Gauge
          title="Cumprimento de prazo"
          description="Fração no prazo entre as com SLA em curso."
          value={sla?.taxa ?? null}
          caption={
            sla && sla.avaliadas > 0
              ? `${sla.no_prazo} no prazo · ${sla.atrasadas} em atraso`
              : 'Sem manifestações com prazo neste recorte.'
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Novas" value={s?.novas ?? 0} hint="aguardando triagem" />
          <StatTile label="Em análise" value={(s?.em_analise ?? 0) + (s?.em_tratamento ?? 0)} />
          <StatTile
            label="Em atraso"
            value={s?.em_atraso ?? 0}
            tone={s?.em_atraso ? 'danger' : undefined}
            hint="prazo vencido"
          />
          <StatTile label="Aguardando" value={s?.aguardando_resposta ?? 0} hint="resposta pendente" />
          <StatTile label="Encerradas" value={s?.encerradas ?? 0} />
          <StatTile
            label="Tempo médio"
            value={s?.tempo_medio_resposta != null ? `${s.tempo_medio_resposta} d` : '—'}
            hint="até a resposta"
          />
        </div>
      </div>

      <FlowChart
        title="Recebidas × encerradas"
        description={`Entradas e saídas por dia nos ${label}.`}
        data={((flow.data ?? []) as Array<{ dia: string; recebidas: number; encerradas: number }>).map((r) => ({
          dia: r.dia,
          recebidas: Number(r.recebidas),
          encerradas: Number(r.encerradas),
        }))}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <BarList
          title="Por tipo"
          description="Cor e forma indicam a gravidade."
          data={toChart(tipos)}
        />
        <BarList
          title="Por status"
          data={toChart(porStatus.data as Breakdown[] | null).map((r) => ({
            ...r,
            rotulo: STATUS_LABEL[r.rotulo as OccurrenceStatus] ?? r.rotulo,
          }))}
        />
        <BarList
          title="Por estado"
          description="Onde estão as manifestações."
          data={toChart(porEstado.data as Breakdown[] | null)}
        />
        <BarList
          title="Por loja"
          description="Útil para comparar unidades."
          data={toChart(porFilial.data as Breakdown[] | null)}
        />
        <BarList
          title="Por categoria"
          description="Mostra quais assuntos mais aparecem."
          data={toChart(porCategoria.data as Breakdown[] | null)}
          className="lg:col-span-2"
        />
      </div>

      <p className="text-xs text-muted">
        {s?.anonimas ?? 0} das {s?.total ?? 0} manifestações do recorte foram anônimas.{' '}
        <Link href="/painel/ocorrencias?manifestante=anonimo" className="underline underline-offset-4">
          Ver somente anônimas
        </Link>
      </p>
    </div>
  )
}

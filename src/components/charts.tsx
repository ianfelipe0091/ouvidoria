/**
 * Gráficos do dashboard.
 *
 * Tudo é SVG e HTML escritos à mão, sem biblioteca: são três formas simples, e
 * uma dependência de gráficos custaria mais em peso do que entregaria.
 *
 * Decisões de forma, seguindo o que cada dado precisa fazer:
 *   - números de destaque  -> stat tile, não gráfico de uma barra só
 *   - comparar magnitude   -> barras ordenadas, HUE ÚNICA (não paleta categórica:
 *                             as fatias não são identidades, são quantidades)
 *   - evolução no tempo    -> linha com área, série única
 */
import type { ReactNode } from 'react'

import { Card, CardHeader, cn } from '@/components/ui'

export function StatTile({
  label, value, hint, tone,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'default' | 'danger' | 'warn'
}) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums tracking-tight',
          tone === 'danger' && 'text-danger',
          tone === 'warn' && 'text-warn',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </Card>
  )
}

/**
 * Barras horizontais ordenadas por magnitude.
 *
 * Horizontal porque os rótulos são longos ("Qualidade do atendimento") e, na
 * vertical, virariam texto girado ou truncado.
 */
export function BarList({
  title, description, data, empty = 'Sem dados no período.',
}: {
  title: string
  description?: string
  data: Array<{ rotulo: string; total: number }>
  empty?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.total))
  const totalGeral = data.reduce((sum, d) => sum + d.total, 0)

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="px-5 py-4">
        {data.length === 0 ? (
          <p className="text-xs text-muted">{empty}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data.map((item) => {
              const share = totalGeral ? Math.round((item.total / totalGeral) * 100) : 0
              return (
                <li key={item.rotulo} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate">{item.rotulo}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      <span className="font-medium text-foreground">{item.total}</span>
                      {totalGeral ? ` · ${share}%` : ''}
                    </span>
                  </div>
                  {/* A trilha marca o 100%; a barra é fina e tem a ponta
                      arredondada só no lado dos dados. */}
                  <div className="h-1.5 w-full rounded-full bg-chart-grid">
                    <div
                      className="h-1.5 rounded-r-full bg-chart"
                      style={{ width: `${Math.max(2, (item.total / max) * 100)}%` }}
                      role="img"
                      aria-label={`${item.rotulo}: ${item.total}`}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}

/**
 * Evolução no tempo: área + linha, série única.
 *
 * Sem legenda de propósito — com uma série só, o título já diz o que a linha é.
 * Os pontos trazem <title>, que o navegador mostra no hover e os leitores de
 * tela anunciam.
 */
export function TrendChart({
  title, description, data,
}: {
  title: string
  description?: string
  data: Array<{ dia: string; total: number }>
}) {
  const width = 720
  const height = 180
  const padding = { top: 12, right: 8, bottom: 22, left: 28 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const max = Math.max(1, ...data.map((d) => d.total))
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0
  const x = (i: number) => padding.left + i * stepX
  const y = (v: number) => padding.top + plotHeight - (v / max) * plotHeight

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.total)}`).join(' ')
  const area =
    data.length > 1
      ? `${line} L ${x(data.length - 1)} ${padding.top + plotHeight} L ${x(0)} ${padding.top + plotHeight} Z`
      : ''

  // Quatro marcas no eixo Y bastam para dar escala sem virar grade densa.
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f))
  const totalPeriodo = data.reduce((sum, d) => sum + d.total, 0)

  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        action={
          <span className="text-xs text-muted">
            <span className="font-medium text-foreground tabular-nums">{totalPeriodo}</span> no total
          </span>
        }
      />
      <div className="overflow-x-auto px-5 py-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full min-w-[420px]"
          role="img"
          aria-label={`Manifestações por dia. Total de ${totalPeriodo} no período.`}
        >
          {ticks.map((value) => (
            <g key={value}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
              <text
                x={padding.left - 6}
                y={y(value) + 3}
                textAnchor="end"
                className="fill-[var(--muted)] text-[9px] tabular-nums"
              >
                {value}
              </text>
            </g>
          ))}

          {area ? <path d={area} fill="var(--chart)" opacity={0.12} /> : null}
          <path d={line} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" />

          {data.map((d, i) => (
            <circle
              key={d.dia}
              cx={x(i)}
              cy={y(d.total)}
              r={4}
              fill="var(--chart)"
              opacity={d.total > 0 ? 1 : 0}
            >
              <title>{`${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${d.dia}T12:00:00`))}: ${d.total}`}</title>
            </circle>
          ))}

          {/* Só as extremidades recebem rótulo: um por dia viraria um borrão. */}
          {data.length > 1 ? (
            <>
              <text x={x(0)} y={height - 6} textAnchor="start" className="fill-[var(--muted)] text-[9px]">
                {shortDate(data[0].dia)}
              </text>
              <text x={x(data.length - 1)} y={height - 6} textAnchor="end" className="fill-[var(--muted)] text-[9px]">
                {shortDate(data[data.length - 1].dia)}
              </text>
            </>
          ) : null}
        </svg>
      </div>
    </Card>
  )
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
    new Date(`${value}T12:00:00`),
  )
}

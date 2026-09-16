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
import {
  SEVERITY_LABEL, SEVERITY_SHAPE, severityColor, type Severity,
} from '@/lib/domain'

/**
 * Marcador de gravidade: cor + forma.
 *
 * A forma não é enfeite. Vermelho (denúncia) e verde (elogio) colapsam sob
 * deuteranopia, então quem não separa as duas cores distingue pela forma — e
 * pelo rótulo, que acompanha todo marcador.
 */
export function SeverityMark({
  severity, size = 10, className,
}: {
  severity: Severity
  size?: number
  className?: string
}) {
  const shape = SEVERITY_SHAPE[severity]
  const color = severityColor(severity)
  const half = size / 2

  const path =
    shape === 'triangulo'
      ? `M ${half} 1 L ${size - 1} ${size - 1.5} L 1 ${size - 1.5} Z`
      : shape === 'losango'
        ? `M ${half} 0.5 L ${size - 0.5} ${half} L ${half} ${size - 0.5} L 0.5 ${half} Z`
        : shape === 'estrela'
          ? estrela(half, half, half - 0.5, (half - 0.5) * 0.45)
          : ''

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0', className)}
      role="img"
      aria-label={SEVERITY_LABEL[severity]}
    >
      {shape === 'circulo' ? (
        <circle cx={half} cy={half} r={half - 0.5} fill={color} />
      ) : (
        <path d={path} fill={color} />
      )}
    </svg>
  )
}

function estrela(cx: number, cy: number, raioExterno: number, raioInterno: number) {
  const pontos: string[] = []
  for (let i = 0; i < 10; i++) {
    const raio = i % 2 === 0 ? raioExterno : raioInterno
    const angulo = (Math.PI / 5) * i - Math.PI / 2
    pontos.push(`${(cx + raio * Math.cos(angulo)).toFixed(2)} ${(cy + raio * Math.sin(angulo)).toFixed(2)}`)
  }
  return `M ${pontos.join(' L ')} Z`
}

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
  title, description, data, empty = 'Sem dados no período.', className,
}: {
  title: string
  description?: string
  data: Array<{ rotulo: string; total: number; severidade?: Severity | null }>
  empty?: string
  className?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.total))
  const totalGeral = data.reduce((sum, d) => sum + d.total, 0)

  return (
    <Card className={className}>
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
                    <span className="flex min-w-0 items-center gap-1.5">
                      {item.severidade ? (
                        <SeverityMark severity={item.severidade} className="translate-y-px" />
                      ) : null}
                      <span className="truncate">{item.rotulo}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      <span className="font-medium text-foreground">{item.total}</span>
                      {totalGeral ? ` · ${share}%` : ''}
                    </span>
                  </div>
                  {/* A trilha marca o 100%; a barra é fina e tem a ponta
                      arredondada só no lado dos dados. */}
                  <div className="h-1.5 w-full rounded-full bg-chart-grid">
                    <div
                      className="h-1.5 rounded-r-full"
                      style={{
                        width: `${Math.max(2, (item.total / max) * 100)}%`,
                        background: item.severidade ? severityColor(item.severidade) : 'var(--chart)',
                      }}
                      role="img"
                      aria-label={`${item.rotulo}: ${item.total}${
                        item.severidade ? ` (${SEVERITY_LABEL[item.severidade]})` : ''
                      }`}
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

/**
 * "Relógio" do total: anel segmentado por gravidade, com o número ao centro.
 *
 * O anel dá a leitura rápida da composição; o número dá o total exato. As
 * fatias são separadas por uma folga da cor da superfície, para que duas
 * gravidades vizinhas não se fundam numa mancha só.
 *
 * A legenda traz forma, rótulo e valor: a identidade de cada fatia nunca
 * depende só da cor.
 */
export function SeverityDial({
  title, description, total, data, emptyLabel = 'Sem manifestações no período.',
}: {
  title: string
  description?: string
  total: number
  data: Array<{ severidade: Severity; rotulo: string; total: number }>
  emptyLabel?: string
}) {
  const size = 168
  const stroke = 18
  const raio = (size - stroke) / 2
  const circunferencia = 2 * Math.PI * raio
  // Folga entre fatias, em unidades de arco. Some só quando há mais de uma.
  const folga = data.length > 1 ? 3 : 0

  // O início de cada fatia é a soma das anteriores. Calculado a partir dos
  // dados, sem acumulador mutável: são poucas fatias e o custo é irrelevante
  // perto de ter uma variável sendo reescrita durante a renderização.
  const fatias = data.map((item, indice) => {
    const proporcao = total > 0 ? item.total / total : 0
    const anteriores = data.slice(0, indice).reduce((soma, d) => soma + d.total, 0)
    return {
      ...item,
      proporcao,
      comprimento: Math.max(0, proporcao * circunferencia - folga),
      inicio: total > 0 ? (anteriores / total) * circunferencia : 0,
    }
  })

  const resumo = data.map((d) => `${d.rotulo}: ${d.total}`).join(', ')

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="flex flex-col items-center gap-5 px-5 py-5 sm:flex-row sm:items-center sm:gap-7">
        <div className="relative shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={
              total > 0
                ? `Total de ${total} manifestações. ${resumo}.`
                : emptyLabel
            }
          >
            {/* Trilha: marca o círculo completo mesmo quando não há dados. */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={raio}
              fill="none"
              stroke="var(--chart-grid)"
              strokeWidth={stroke}
            />
            {/* Começa no topo, em vez de às 3 horas. */}
            <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              {fatias.map((fatia) => (
                <circle
                  key={fatia.severidade}
                  cx={size / 2}
                  cy={size / 2}
                  r={raio}
                  fill="none"
                  stroke={severityColor(fatia.severidade)}
                  strokeWidth={stroke}
                  strokeDasharray={`${fatia.comprimento} ${circunferencia - fatia.comprimento}`}
                  strokeDashoffset={-fatia.inicio}
                  strokeLinecap="butt"
                >
                  <title>{`${fatia.rotulo}: ${fatia.total} (${Math.round(fatia.proporcao * 100)}%)`}</title>
                </circle>
              ))}
            </g>
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums tracking-tight">{total}</span>
            <span className="text-[11px] text-muted">
              {total === 1 ? 'manifestação' : 'manifestações'}
            </span>
          </div>
        </div>

        <ul className="flex w-full min-w-0 flex-col gap-2">
          {data.length === 0 ? (
            <li className="text-xs text-muted">{emptyLabel}</li>
          ) : (
            data.map((item) => (
              <li key={item.severidade} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <SeverityMark severity={item.severidade} />
                  <span className="truncate">{item.rotulo}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  <span className="font-medium text-foreground">{item.total}</span>
                  {total > 0 ? ` · ${Math.round((item.total / total) * 100)}%` : ''}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </Card>
  )
}

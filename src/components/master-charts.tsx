'use client'

/**
 * Peças visuais do painel Master.
 *
 * Seguem a mesma disciplina dos gráficos do painel do cliente (charts.tsx):
 * uma série por gráfico em --chart, marcas finas com ponta arredondada só no
 * lado dos dados, grade recessiva, rótulo direto seletivo (nunca um número em
 * cada barra) e camada de hover. Cores de situação só na barra da carteira, e
 * sempre acompanhadas de rótulo — nunca a cor sozinha.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Card, CardHeader, cn } from '@/components/ui'

// ------------------------------------------------------------ indicador --

type Delta = { value: number; label: string } | null

/**
 * Número-destaque. Quando há comparação, a variação vem com seta e texto — a
 * cor reforça, mas "▲ 12% vs mês anterior" se lê sem ela.
 */
export function KpiCard({
  label, value, hint, delta, tone, icon,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  delta?: Delta
  tone?: 'danger' | 'warn'
  icon?: ReactNode
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon ? (
          <span
            aria-hidden
            className={cn(
              'grid size-8 place-items-center rounded-lg',
              tone === 'danger' ? 'bg-danger-soft text-danger' : tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent',
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          'text-3xl font-semibold tabular-nums tracking-tight',
          tone === 'danger' && 'text-danger',
          tone === 'warn' && 'text-warn',
        )}
      >
        {value}
      </p>
      {delta || hint ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {delta ? (
            <span
              className={cn(
                'font-medium',
                delta.value > 0 ? 'text-ok' : delta.value < 0 ? 'text-danger' : 'text-muted',
              )}
            >
              {delta.value > 0 ? '▲' : delta.value < 0 ? '▼' : '='} {delta.label}
            </span>
          ) : null}
          {hint ? <span>{hint}</span> : null}
        </p>
      ) : null}
    </Card>
  )
}

// ----------------------------------------------------- barras por mês ----

export type MonthPoint = { key: string; label: string; value: number }

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function fmt(value: number, money: boolean) {
  return money ? BRL.format(value) : value.toLocaleString('pt-BR')
}

/** Rótulo curto de eixo: "R$ 1,2 mil" em vez de "R$ 1.234,00". */
function axisLabel(value: number, money: boolean) {
  if (value >= 1000) {
    const k = (value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    return money ? `R$ ${k} mil` : `${k} mil`
  }
  return money ? `R$ ${Math.round(value)}` : String(Math.round(value))
}

/**
 * Passo "redondo" da grade (1, 2, 2,5 ou 5 × 10ⁿ) para que o topo do eixo
 * caia num número legível e a grade nunca repita rótulos (0, 1, 1).
 */
function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= raw) return m * pow
  return 10 * pow
}

/**
 * Evolução mensal em colunas, série única.
 *
 * Colunas e não linha: são totais fechados por mês, não uma grandeza contínua.
 * Rótulo direto só no mês atual (o que se quer saber primeiro); os demais
 * aparecem no hover, que acende a coluna e apaga as vizinhas.
 */
export function MonthlyBars({
  title, description, data, money = false, footer,
}: {
  title: string
  description?: string
  data: MonthPoint[]
  money?: boolean
  footer?: ReactNode
}) {
  const [hover, setHover] = useState<number | null>(null)
  // O SVG é desenhado na largura real do cartão, e não esticado a partir de
  // uma largura fixa: assim o texto do eixo tem o mesmo tamanho no celular e
  // no desktop, em vez de encolher até ficar ilegível.
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(560)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const height = 200
  const pad = { top: 26, right: 8, bottom: 26, left: 56 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  // Contagens pedem passo inteiro: com 2,5 o eixo mostraria "3, 5, 8".
  const rawStep = niceStep(Math.max(...data.map((d) => d.value), 1) / 3)
  const step = Math.max(1, money ? rawStep : Math.ceil(rawStep))
  const max = step * 3
  const slot = plotW / Math.max(1, data.length)
  const barW = Math.min(40, slot * 0.56)
  const y = (v: number) => pad.top + plotH - (v / max) * plotH
  const ticks = [0, 1, 2, 3].map((i) => step * i)
  const total = data.reduce((s, d) => s + d.value, 0)
  const focus = hover ?? data.length - 1

  // Topo arredondado (4px) e base reta, ancorada na linha de base.
  const bar = (x: number, top: number) => {
    const h = pad.top + plotH - top
    if (h <= 0) return ''
    const r = Math.min(4, h, barW / 2)
    return `M ${x} ${pad.top + plotH} V ${top + r} Q ${x} ${top} ${x + r} ${top} H ${x + barW - r} Q ${x + barW} ${top} ${x + barW} ${top + r} V ${pad.top + plotH} Z`
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        title={title}
        description={description}
        action={
          <span className="text-xs text-muted">
            <span className="font-medium text-foreground tabular-nums">{fmt(total, money)}</span> em{' '}
            {data.length} meses
          </span>
        }
      />
      <div ref={box} className="relative flex-1 px-5 py-4">
        {total === 0 ? (
          // Sem nenhum valor, um gráfico de colunas vazias não informa nada;
          // o aviso por cima diz o que aconteceu.
          <p className="pointer-events-none absolute inset-x-5 top-1/2 z-10 -translate-y-1/2 text-center text-xs text-muted">
            Nenhum registro nos últimos {data.length} meses.
          </p>
        ) : null}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={cn('h-48 w-full', total === 0 && 'opacity-40')}
          role="img"
          aria-label={`${title}: ${data.map((d) => `${d.label} ${fmt(d.value, money)}`).join(', ')}`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={y(t) + 3}
                textAnchor="end"
                className="fill-[var(--muted)] text-[10px] tabular-nums"
              >
                {total > 0 ? axisLabel(t, money) : null}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = pad.left + i * slot + (slot - barW) / 2
            const top = y(d.value)
            const active = i === focus
            return (
              <g key={d.key}>
                <path
                  d={bar(x, top)}
                  fill="var(--chart)"
                  opacity={hover === null || active ? 1 : 0.35}
                  className="transition-opacity"
                />
                {d.value === 0 ? (
                  // Mês sem valor: um traço na base, para não parecer dado faltante.
                  <line
                    x1={x}
                    x2={x + barW}
                    y1={pad.top + plotH - 1}
                    y2={pad.top + plotH - 1}
                    stroke="var(--chart)"
                    strokeWidth={2}
                    opacity={0.35}
                  />
                ) : null}
                {active && total > 0 ? (
                  <text
                    x={x + barW / 2}
                    y={Math.min(top, pad.top + plotH) - 8}
                    textAnchor="middle"
                    className="fill-[var(--foreground)] text-[11px] font-semibold tabular-nums"
                  >
                    {fmt(d.value, money)}
                  </text>
                ) : null}
                <text
                  x={x + barW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className={cn('text-[10px]', active ? 'fill-[var(--foreground)] font-medium' : 'fill-[var(--muted)]')}
                >
                  {d.label}
                </text>
                {/* Alvo de hover do tamanho da coluna inteira, maior que a barra. */}
                <rect
                  x={pad.left + i * slot}
                  y={pad.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                >
                  <title>{`${d.label}: ${fmt(d.value, money)}`}</title>
                </rect>
              </g>
            )
          })}
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={pad.top + plotH}
            y2={pad.top + plotH}
            stroke="var(--border)"
            strokeWidth={1}
          />
        </svg>
      </div>
      {footer ? <div className="border-t border-border px-5 py-3 text-xs text-muted">{footer}</div> : null}
    </Card>
  )
}

// ------------------------------------------------ situação da carteira ----

export type PortfolioSlice = {
  key: 'ok' | 'trial' | 'attention' | 'blocked'
  label: string
  count: number
  hint: string
}

const SLICE_COLOR: Record<PortfolioSlice['key'], string> = {
  ok: 'var(--st-ok)',
  trial: 'var(--st-trial)',
  attention: 'var(--st-attn)',
  blocked: 'var(--st-block)',
}

/** Símbolo de cada faixa: a identidade não depende só da cor. */
const SLICE_ICON: Record<PortfolioSlice['key'], string> = {
  ok: '✓',
  trial: '◷',
  attention: '!',
  blocked: '✕',
}

/**
 * Composição da carteira numa barra 100% segmentada, com folga de 2px da cor
 * da superfície entre segmentos e legenda com símbolo, rótulo e contagem.
 * Barra e não rosca: com quatro faixas, comprimento lado a lado se compara
 * melhor que ângulo.
 */
export function PortfolioBar({
  slices, outside,
}: {
  slices: PortfolioSlice[]
  /** Empresas fora da carteira ativa (canceladas), mostradas à parte. */
  outside: number
}) {
  const [hover, setHover] = useState<PortfolioSlice['key'] | null>(null)
  const total = slices.reduce((s, x) => s + x.count, 0)
  const visible = slices.filter((s) => s.count > 0)

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Situação da carteira"
        description="Como estão as empresas clientes hoje."
        action={
          <span className="text-xs text-muted">
            <span className="font-medium text-foreground tabular-nums">{total}</span> ativas na carteira
          </span>
        }
      />
      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        {total === 0 ? (
          <p className="text-xs text-muted">Nenhuma empresa na carteira.</p>
        ) : (
          <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img"
            aria-label={visible.map((s) => `${s.label}: ${s.count}`).join(', ')}>
            {visible.map((s) => (
              <div
                key={s.key}
                style={{ flexGrow: s.count, background: SLICE_COLOR[s.key] }}
                className={cn('h-full transition-opacity', hover && hover !== s.key && 'opacity-35')}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover(null)}
                title={`${s.label}: ${s.count}`}
              />
            ))}
          </div>
        )}

        <ul className="flex flex-col gap-1">
          {slices.map((s) => {
            const pct = total ? Math.round((s.count / total) * 100) : 0
            return (
              <li
                key={s.key}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2 py-2 transition-colors',
                  hover === s.key && 'bg-surface-muted',
                )}
              >
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-bold text-white"
                  style={{ background: SLICE_COLOR[s.key] }}
                >
                  {SLICE_ICON[s.key]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{s.label}</span>
                  <span className="block text-[11px] text-muted">{s.hint}</span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block text-sm font-semibold">{s.count}</span>
                  <span className="block text-[11px] text-muted">{pct}%</span>
                </span>
              </li>
            )
          })}
        </ul>
        {outside ? (
          <p className="text-[11px] text-muted">
            + {outside} {outside === 1 ? 'empresa cancelada' : 'empresas canceladas'} (fora da carteira)
          </p>
        ) : null}
      </div>
    </Card>
  )
}

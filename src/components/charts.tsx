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

/**
 * Velocímetro de saúde: um arco de 0 a 100 com zonas coloridas e um ponteiro.
 *
 * É o "relógio" da operação. Uma taxa isolada — cumprimento de prazo — contra
 * um alvo é exatamente o caso de um medidor radial: o arco mostra a posição na
 * escala, as zonas dizem se está saudável, e o número ao centro dá o valor
 * exato. A cor nunca decide sozinha — o número e o rótulo da zona sempre
 * acompanham, então quem não distingue vermelho de verde lê pelo texto.
 *
 * Zonas (quanto maior, melhor): < aviso = crítico, < bom = atenção, resto = ok.
 */
export function Gauge({
  title, description, value, suffix = '%', zones = { warn: 70, good: 90 },
  caption,
}: {
  title: string
  description?: string
  value: number | null
  suffix?: string
  zones?: { warn: number; good: number }
  caption?: ReactNode
}) {
  const width = 240
  const height = 140
  const cx = width / 2
  const cy = height - 18
  const raio = 96
  const stroke = 16

  // Semicírculo: 180° (esquerda) a 0° (direita).
  const anguloDe = (v: number) => Math.PI - (Math.max(0, Math.min(100, v)) / 100) * Math.PI
  const ponto = (v: number, r: number) => ({
    x: cx + r * Math.cos(anguloDe(v)),
    y: cy - r * Math.sin(anguloDe(v)),
  })
  // Nenhum trecho de um semicírculo passa de 180°, então a flag de "arco
  // grande" é sempre 0 — com 1, o SVG desenhava o caminho longo, por baixo.
  const arco = (de: number, ate: number, r: number) => {
    const p1 = ponto(de, r)
    const p2 = ponto(ate, r)
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }

  const temValor = value !== null
  const v = temValor ? value : 0
  const zona = v < zones.warn ? 'grave' : v < zones.good ? 'atencao' : 'positivo'
  const zonaCor =
    zona === 'grave' ? 'var(--sev-grave)' : zona === 'atencao' ? 'var(--sev-atencao)' : 'var(--sev-positivo)'
  const zonaRotulo = zona === 'grave' ? 'Crítico' : zona === 'atencao' ? 'Requer atenção' : 'Saudável'

  // Marca da posição: um traço curto atravessando o arco, sem cobrir o número.
  const marcaIn = ponto(v, raio - stroke / 2 - 5)
  const marcaOut = ponto(v, raio + stroke / 2 + 3)

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="flex flex-col items-center gap-2 px-5 py-5">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[16rem]"
          role="img"
          aria-label={
            temValor
              ? `${title}: ${v}${suffix} — ${zonaRotulo}.`
              : `${title}: sem dados no período.`
          }
        >
          {/* Três zonas de fundo, em tom suave, marcam a régua de saúde. */}
          <path d={arco(0, zones.warn, raio)} fill="none" stroke="var(--sev-grave-soft)" strokeWidth={stroke} />
          <path d={arco(zones.warn, zones.good, raio)} fill="none" stroke="var(--sev-atencao-soft)" strokeWidth={stroke} />
          <path d={arco(zones.good, 100, raio)} fill="none" stroke="var(--sev-positivo-soft)" strokeWidth={stroke} />

          {/* Arco preenchido até o valor, na cor da zona atingida. */}
          {temValor ? (
            <path d={arco(0, Math.max(0.5, v), raio)} fill="none" stroke={zonaCor} strokeWidth={stroke} />
          ) : null}

          {temValor ? (
            <line
              x1={marcaIn.x.toFixed(2)}
              y1={marcaIn.y.toFixed(2)}
              x2={marcaOut.x.toFixed(2)}
              y2={marcaOut.y.toFixed(2)}
              stroke="var(--foreground)"
              strokeWidth={3}
              strokeLinecap="round"
            />
          ) : null}

          {/* Valor no vão do arco. */}
          <text
            x={cx}
            y={cy - 14}
            textAnchor="middle"
            className="fill-[var(--foreground)] text-[34px] font-semibold tabular-nums"
          >
            {temValor ? `${v}${suffix}` : '—'}
          </text>

          {/* Extremos da régua, abaixo das pontas do arco. */}
          <text x={ponto(0, raio).x} y={cy + 14} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">0</text>
          <text x={ponto(100, raio).x} y={cy + 14} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">100</text>
        </svg>

        {temValor ? (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: `var(--sev-${zona}-soft)`, color: zonaCor }}
          >
            {zonaRotulo}
          </span>
        ) : (
          <span className="text-[11px] text-muted">sem dados no período</span>
        )}

        {caption ? <p className="mt-1 text-center text-xs text-muted">{caption}</p> : null}
      </div>
    </Card>
  )
}

/**
 * Fluxo de entradas e saídas: duas séries (recebidas, encerradas) na mesma
 * escala, ao longo do tempo.
 *
 * Uma escala só, nunca duas — as duas séries contam a mesma coisa (número de
 * manifestações por dia), então comparar as alturas é o ponto. A legenda é
 * obrigatória com duas séries; a cor foi validada (ΔE 25 entre azul e verde) e
 * ainda assim cada linha tem seu nome na legenda, para não depender da cor.
 *
 * Colunas lado a lado por dia (por semana em períodos longos), e não linhas:
 * com poucos registros por dia, a linha virava uma sequência de picos.
 * A leitura que importa: quando as recebidas passam das encerradas, o acúmulo
 * está crescendo.
 */
export function FlowChart({
  title, description, data,
}: {
  title: string
  description?: string
  data: Array<{ dia: string; recebidas: number; encerradas: number }>
}) {
  // Períodos longos viram semanas: 90 colunas-dia não cabem legíveis.
  const series0 = data.length > 45 ? porSemana(data) : data
  const width = 720
  const height = 200
  const padding = { top: 16, right: 8, bottom: 24, left: 30 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const bruto = Math.max(1, ...series0.flatMap((d) => [d.recebidas, d.encerradas]))
  const passo = Math.max(1, Math.ceil(bruto / 3))
  const max = passo * 3
  const ticks = [0, passo, passo * 2, max]
  const y = (v: number) => padding.top + plotHeight - (v / max) * plotHeight
  const base = padding.top + plotHeight

  const slot = plotWidth / Math.max(1, series0.length)
  const barra = Math.max(2, Math.min(14, (slot - 4) / 2))
  const gap = Math.min(2, barra / 3)

  // Coluna com topo arredondado e base reta, apoiada na linha de base.
  const coluna = (x: number, v: number) => {
    if (v <= 0) return ''
    const top = y(v)
    const r = Math.min(3, barra / 2, base - top)
    return `M ${x} ${base} V ${top + r} Q ${x} ${top} ${x + r} ${top} H ${x + barra - r} Q ${x + barra} ${top} ${x + barra} ${top + r} V ${base} Z`
  }

  const totalRecebidas = data.reduce((s, d) => s + d.recebidas, 0)
  const totalEncerradas = data.reduce((s, d) => s + d.encerradas, 0)
  const semanal = series0 !== data

  const series = [
    { chave: 'recebidas' as const, rotulo: 'Recebidas', cor: 'var(--flow-in)', total: totalRecebidas },
    { chave: 'encerradas' as const, rotulo: 'Encerradas', cor: 'var(--flow-out)', total: totalEncerradas },
  ]
  const meio = Math.floor((series0.length - 1) / 2)

  return (
    <Card>
      <CardHeader
        title={title}
        description={semanal ? `${description ?? ''} Agrupado por semana.`.trim() : description}
        action={
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {series.map((s) => (
              <span key={s.chave} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm" style={{ background: s.cor }} />
                {s.rotulo}
                <span className="font-medium tabular-nums">{s.total}</span>
              </span>
            ))}
          </div>
        }
      />
      <div className="overflow-x-auto px-5 py-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-48 w-full min-w-[460px]"
          role="img"
          aria-label={`Fluxo do período: ${totalRecebidas} recebidas e ${totalEncerradas} encerradas.`}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={padding.left} x2={width - padding.right} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={padding.left - 6} y={y(v) + 3} textAnchor="end" className="fill-[var(--muted)] text-[9px] tabular-nums">{v}</text>
            </g>
          ))}

          {series0.map((d, i) => {
            const x0 = padding.left + i * slot + (slot - (barra * 2 + gap)) / 2
            const rotulo = semanal ? `semana de ${shortDate(d.dia)}` : shortDate(d.dia)
            return (
              <g key={d.dia} className="group">
                {/* Faixa de destaque no hover, do tamanho do dia inteiro. */}
                <rect
                  x={padding.left + i * slot}
                  y={padding.top}
                  width={slot}
                  height={plotHeight}
                  className="fill-[var(--chart-grid)] opacity-0 transition-opacity group-hover:opacity-60"
                />
                <path d={coluna(x0, d.recebidas)} fill="var(--flow-in)" />
                <path d={coluna(x0 + barra + gap, d.encerradas)} fill="var(--flow-out)" />
                <title>{`${rotulo} — recebidas: ${d.recebidas}, encerradas: ${d.encerradas}`}</title>
              </g>
            )
          })}

          <line x1={padding.left} x2={width - padding.right} y1={base} y2={base} stroke="var(--border)" strokeWidth={1} />

          {series0.length > 1 ? (
            <>
              <text x={padding.left} y={height - 6} textAnchor="start" className="fill-[var(--muted)] text-[9px]">{shortDate(series0[0].dia)}</text>
              {series0.length > 6 ? (
                <text x={padding.left + meio * slot + slot / 2} y={height - 6} textAnchor="middle" className="fill-[var(--muted)] text-[9px]">{shortDate(series0[meio].dia)}</text>
              ) : null}
              <text x={width - padding.right} y={height - 6} textAnchor="end" className="fill-[var(--muted)] text-[9px]">{shortDate(series0[series0.length - 1].dia)}</text>
            </>
          ) : null}
        </svg>
      </div>
    </Card>
  )
}

/** Soma dias consecutivos em blocos de 7, rotulados pelo primeiro dia. */
function porSemana(data: Array<{ dia: string; recebidas: number; encerradas: number }>) {
  const out: typeof data = []
  for (let i = 0; i < data.length; i += 7) {
    const bloco = data.slice(i, i + 7)
    out.push({
      dia: bloco[0].dia,
      recebidas: bloco.reduce((s, d) => s + d.recebidas, 0),
      encerradas: bloco.reduce((s, d) => s + d.encerradas, 0),
    })
  }
  return out
}

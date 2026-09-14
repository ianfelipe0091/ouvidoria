'use client'

import { useState, useTransition } from 'react'

import {
  Badge, Button, Card, CardHeader, Field, FormError, Input, Textarea, cn,
} from '@/components/ui'
import { STATUS_LABEL, STATUS_TONE, RESOLUTION_LABEL, formatDate, formatDateTime } from '@/lib/domain'
import {
  rateManifestacao, replyManifestacao, trackManifestacao, type TrackedManifestacao,
} from './actions'

export function TrackClient({ slug }: { slug: string }) {
  const [protocol, setProtocol] = useState('')
  const [code, setCode] = useState('')
  const [data, setData] = useState<TrackedManifestacao | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function lookup() {
    startTransition(async () => {
      const result = await trackManifestacao(slug, protocol, code)
      if (result.ok) {
        setData(result.data)
        setError(null)
      } else {
        setData(null)
        setError(result.error)
      }
    })
  }

  if (!data) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <FormError message={error} />
        <Field label="Protocolo" required>
          <Input
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            placeholder="OUV-2026-000001"
            className="font-mono"
          />
        </Field>
        <Field label="Código de acompanhamento" required>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="font-mono"
          />
        </Field>
        <Button type="button" onClick={lookup} disabled={pending || !protocol || !code}>
          {pending ? 'Consultando…' : 'Consultar'}
        </Button>
      </Card>
    )
  }

  return (
    <ManifestacaoView
      slug={slug}
      protocol={protocol}
      code={code}
      data={data}
      onUpdate={setData}
    />
  )
}

function ManifestacaoView({
  slug, protocol, code, data, onUpdate,
}: {
  slug: string
  protocol: string
  code: string
  data: TrackedManifestacao
  onUpdate: (d: TrackedManifestacao) => void
}) {
  const [body, setBody] = useState('')
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const closed = Boolean(data.closed_at)

  function send() {
    startTransition(async () => {
      const result = await replyManifestacao(slug, protocol, code, body)
      if (result.ok) {
        onUpdate(result.data)
        setBody('')
        setError(null)
      } else setError(result.error)
    })
  }

  function rate() {
    startTransition(async () => {
      const result = await rateManifestacao(slug, protocol, code, stars, comment)
      if (result.ok) {
        onUpdate(result.data)
        setError(null)
      } else setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-sm font-semibold">{data.protocol}</p>
            <p className="mt-0.5 text-xs text-muted">
              Aberta em {formatDate(data.opened_at)}
              {data.is_anonymous ? ' · anônima' : ''}
            </p>
          </div>
          <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          {data.type ? <><dt className="text-muted">Tipo</dt><dd>{data.type}</dd></> : null}
          {data.category ? <><dt className="text-muted">Categoria</dt><dd>{data.category}</dd></> : null}
          {data.subject ? <><dt className="text-muted">Assunto</dt><dd>{data.subject}</dd></> : null}
          {data.branch ? <><dt className="text-muted">Unidade</dt><dd>{data.branch}</dd></> : null}
          <dt className="text-muted">Prazo</dt>
          <dd>{formatDate(data.due_at)}</dd>
        </dl>

        <div className="rounded-lg bg-surface-muted p-3">
          <p className="text-xs text-muted">Seu relato</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{data.description}</p>
        </div>
      </Card>

      {data.answer ? (
        <Card>
          <CardHeader
            title="Resposta da ouvidoria"
            description={
              data.resolution ? `Classificação: ${RESOLUTION_LABEL[data.resolution]}` : undefined
            }
          />
          <p className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap">{data.answer}</p>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Mensagens" description="Converse com a equipe da ouvidoria." />
        <div className="flex flex-col gap-3 px-5 py-4">
          {data.messages.length === 0 ? (
            <p className="text-xs text-muted">Nenhuma mensagem ainda.</p>
          ) : (
            data.messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  message.author === 'manifestante'
                    ? 'self-end bg-accent-soft'
                    : 'self-start bg-surface-muted',
                )}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {message.author === 'manifestante' ? 'Você' : 'Ouvidoria'} ·{' '}
                  {formatDateTime(message.created_at)}
                </p>
              </div>
            ))
          )}

          <FormError message={error} />

          {closed ? (
            <p className="text-xs text-muted">
              Esta manifestação foi encerrada e não recebe novas mensagens.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva sua mensagem…"
                className="min-h-20"
              />
              <Button
                type="button"
                size="sm"
                className="self-end"
                onClick={send}
                disabled={pending || !body.trim()}
              >
                {pending ? 'Enviando…' : 'Enviar'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {data.can_rate ? (
        <Card>
          <CardHeader title="Como você avalia o atendimento recebido?" />
          <div className="flex flex-col gap-3 px-5 py-4">
            <div className="flex gap-1" role="radiogroup" aria-label="Nota de 1 a 5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={stars === value}
                  aria-label={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`}
                  onClick={() => setStars(value)}
                  className={cn(
                    'text-2xl leading-none transition',
                    value <= stars ? 'text-warn' : 'text-border hover:text-muted',
                  )}
                >
                  ★
                </button>
              ))}
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Deseja deixar algum comentário? (opcional)"
              className="min-h-20"
            />
            <Button
              type="button"
              size="sm"
              className="self-start"
              onClick={rate}
              disabled={pending || stars === 0}
            >
              Enviar avaliação
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Histórico" />
        <ol className="flex flex-col gap-3 px-5 py-4">
          {data.timeline.map((event, index) => (
            <li key={index} className="flex gap-3 text-xs">
              <span className="w-28 shrink-0 text-muted">{formatDateTime(event.created_at)}</span>
              <span>{event.description}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

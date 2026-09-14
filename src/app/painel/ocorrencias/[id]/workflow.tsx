'use client'

import { useState, useTransition } from 'react'

import {
  Badge, Button, Card, CardHeader, Field, FormError, Input, Select, Textarea, cn,
} from '@/components/ui'
import {
  RESOLUTION_LABEL, STATUS_FLOW, STATUS_LABEL, TASK_STATUS_LABEL,
  formatDate, formatDateTime, type OccurrenceStatus, type TaskStatus,
} from '@/lib/domain'
import {
  answerOccurrence, assignOccurrence, attachmentUrl, completeTask, createTask,
  postMessage, updateStatus, uploadAttachments,
} from './actions'

type Option = { id: string; name: string }

export function StatusControl({
  occurrenceId, status,
}: { occurrenceId: string; status: OccurrenceStatus }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as OccurrenceStatus
            startTransition(async () => {
              const result = await updateStatus(occurrenceId, next)
              setError(result.error ?? null)
            })
          }}
          aria-label="Situação da manifestação"
          className="w-auto!"
        >
          {STATUS_FLOW.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
          <option value="cancelada">{STATUS_LABEL.cancelada}</option>
          <option value="descartada">{STATUS_LABEL.descartada}</option>
        </Select>
        {pending ? <span className="text-xs text-muted">salvando…</span> : null}
      </div>
      <FormError message={error} />
    </div>
  )
}

export function AssignPanel({
  occurrenceId, departments, assignees, departmentId, assigneeId, dueAt,
}: {
  occurrenceId: string
  departments: Option[]
  assignees: Array<{ id: string; full_name: string }>
  departmentId: string | null
  assigneeId: string | null
  dueAt: string
}) {
  const [department, setDepartment] = useState(departmentId ?? '')
  const [assignee, setAssignee] = useState(assigneeId ?? '')
  const [due, setDue] = useState(dueAt.slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Card>
      <CardHeader title="Encaminhamento" description="Defina área, responsável e prazo." />
      <div className="flex flex-col gap-3 px-5 py-4">
        <FormError message={error} />
        <Field label="Departamento">
          <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">Sem departamento</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Responsável">
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Sem responsável</option>
            {assignees.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Prazo de resposta">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Button
          size="sm"
          className="self-start"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await assignOccurrence(occurrenceId, {
                departmentId: department || null,
                assigneeId: assignee || null,
                dueAt: due || null,
              })
              setError(result.error ?? null)
            })
          }
        >
          {pending ? 'Salvando…' : 'Salvar encaminhamento'}
        </Button>
      </div>
    </Card>
  )
}

export function MessagePanel({
  occurrenceId, messages, isAnonymous, closed,
}: {
  occurrenceId: string
  messages: Array<{
    id: string
    author: 'manifestante' | 'operador'
    body: string
    is_internal: boolean
    created_at: string
    profiles: { full_name: string } | null
  }>
  isAnonymous: boolean
  closed: boolean
}) {
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Card>
      <CardHeader
        title="Mensagens"
        description={
          isAnonymous
            ? 'A manifestação é anônima. O manifestante lê as respostas pelo protocolo.'
            : 'Conversa com o manifestante.'
        }
      />
      <div className="flex flex-col gap-3 px-5 py-4">
        {messages.length === 0 ? (
          <p className="text-xs text-muted">Nenhuma mensagem ainda.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                message.is_internal
                  ? 'self-start border border-dashed border-warn bg-warn-soft'
                  : message.author === 'operador'
                    ? 'self-end bg-accent-soft'
                    : 'self-start bg-surface-muted',
              )}
            >
              {message.is_internal ? (
                <Badge tone="warn" className="mb-1">Nota interna</Badge>
              ) : null}
              <p className="whitespace-pre-wrap">{message.body}</p>
              <p className="mt-1 text-[11px] text-muted">
                {message.author === 'manifestante'
                  ? 'Manifestante'
                  : (message.profiles?.full_name ?? 'Equipe')}{' '}
                · {formatDateTime(message.created_at)}
              </p>
            </div>
          ))
        )}

        <FormError message={error} />

        {closed ? (
          <p className="text-xs text-muted">Manifestação encerrada — não recebe novas mensagens.</p>
        ) : (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={internal ? 'Nota visível apenas para a equipe…' : 'Mensagem ao manifestante…'}
              className="min-h-20"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
                Nota interna (o manifestante não vê)
              </label>
              <Button
                size="sm"
                disabled={pending || !body.trim()}
                onClick={() =>
                  startTransition(async () => {
                    const result = await postMessage(occurrenceId, body, internal)
                    if (!result.error) setBody('')
                    setError(result.error ?? null)
                  })
                }
              >
                {pending ? 'Enviando…' : 'Enviar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export function AnswerPanel({
  occurrenceId, answer, resolution, closed,
}: {
  occurrenceId: string
  answer: string | null
  resolution: keyof typeof RESOLUTION_LABEL | null
  closed: boolean
}) {
  const [text, setText] = useState(answer ?? '')
  const [pick, setPick] = useState<string>(resolution ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(close: boolean) {
    startTransition(async () => {
      const result = await answerOccurrence(occurrenceId, {
        answer: text,
        resolution: (pick || null) as never,
        closingReason: reason,
        close,
      })
      setError(result.error ?? null)
    })
  }

  return (
    <Card>
      <CardHeader
        title="Resposta e encerramento"
        description="A resposta fica visível ao manifestante na consulta por protocolo."
      />
      <div className="flex flex-col gap-3 px-5 py-4">
        <FormError message={error} />
        <Field label="Resposta ao manifestante" required>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-32"
            disabled={closed}
          />
        </Field>
        <Field label="Classificação final">
          <Select value={pick} onChange={(e) => setPick(e.target.value)} disabled={closed}>
            <option value="">Não classificada</option>
            {Object.entries(RESOLUTION_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Motivo do encerramento" hint="Registro interno. Opcional.">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-16"
            disabled={closed}
          />
        </Field>

        {closed ? (
          <p className="text-xs text-muted">Manifestação já encerrada.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => submit(false)}>
              Salvar resposta
            </Button>
            <Button size="sm" disabled={pending} onClick={() => submit(true)}>
              {pending ? 'Salvando…' : 'Responder e encerrar'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

export function TaskPanel({
  occurrenceId, tasks, assignees,
}: {
  occurrenceId: string
  tasks: Array<{
    id: string
    title: string
    status: TaskStatus
    due_on: string | null
    profiles: { full_name: string } | null
  }>
  assignees: Array<{ id: string; full_name: string }>
}) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [due, setDue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Card>
      <CardHeader
        title="Ações internas"
        description="Tarefas que precisam acontecer para tratar a manifestação."
      />
      <div className="flex flex-col gap-3 px-5 py-4">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted">Nenhuma ação registrada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm">{task.title}</p>
                  <p className="text-[11px] text-muted">
                    {task.profiles?.full_name ?? 'Sem responsável'}
                    {task.due_on ? ` · até ${formatDate(task.due_on)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={task.status === 'concluida' ? 'ok' : 'neutral'}>
                    {TASK_STATUS_LABEL[task.status]}
                  </Badge>
                  {task.status !== 'concluida' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await completeTask(task.id, occurrenceId)
                          setError(result.error ?? null)
                        })
                      }
                    >
                      Concluir
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <FormError message={error} />

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nova ação — ex.: verificar documentação"
          />
          <div className="flex flex-wrap gap-2">
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-auto!" aria-label="Responsável pela ação">
              <option value="">Sem responsável</option>
              {assignees.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </Select>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-auto!" aria-label="Prazo da ação" />
            <Button
              size="sm"
              disabled={pending || !title.trim()}
              onClick={() =>
                startTransition(async () => {
                  const result = await createTask(occurrenceId, {
                    title,
                    assigneeId: assignee || null,
                    dueOn: due || null,
                  })
                  if (!result.error) { setTitle(''); setDue('') }
                  setError(result.error ?? null)
                })
              }
            >
              Adicionar
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function AttachmentPanel({
  occurrenceId, attachments, maxMb, extensions,
}: {
  occurrenceId: string
  attachments: Array<{
    id: string
    file_name: string
    size_bytes: number
    storage_path: string
    uploaded_by_reporter: boolean
    created_at: string
  }>
  maxMb: number
  extensions: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Card>
      <CardHeader
        title="Anexos"
        description={`Até ${maxMb} MB por arquivo. PDF, imagem, Word ou Excel.`}
      />
      <div className="flex flex-col gap-3 px-5 py-4">
        {attachments.length === 0 ? (
          <p className="text-xs text-muted">Nenhum anexo.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attachments.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{file.file_name}</p>
                  <p className="text-[11px] text-muted">
                    {formatBytes(file.size_bytes)}
                    {file.uploaded_by_reporter ? ' · enviado pelo manifestante' : ''}
                    {' · '}{formatDateTime(file.created_at)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await attachmentUrl(file.storage_path)
                      if (result.url) window.open(result.url, '_blank', 'noopener')
                      else setError(result.error ?? 'Não foi possível abrir o arquivo.')
                    })
                  }
                >
                  Baixar
                </Button>
              </li>
            ))}
          </ul>
        )}

        <FormError message={error} />

        <form
          className="flex flex-wrap items-center gap-2 border-t border-border pt-3"
          action={(formData) =>
            startTransition(async () => {
              const result = await uploadAttachments(occurrenceId, formData)
              setError(result.error ?? null)
            })
          }
        >
          <input
            type="file"
            name="files"
            multiple
            accept={extensions}
            aria-label="Arquivos para anexar"
            className="text-xs file:mr-2 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {pending ? 'Enviando…' : 'Anexar'}
          </Button>
        </form>
      </div>
    </Card>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

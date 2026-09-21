import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge, Card, CardHeader } from '@/components/ui'
import { requireProfile } from '@/lib/auth'
import {
  CLOSED_STATUSES, SLA_LABEL, SLA_TONE, STATUS_LABEL, STATUS_TONE,
  formatDate, formatDateTime, slaState,
} from '@/lib/domain'
import { ALLOWED_EXTENSIONS } from '@/lib/attachments'
import {
  AnswerPanel, AssignPanel, AttachmentPanel, MessagePanel, StatusControl, TaskPanel,
} from './workflow'

export default async function OccurrencePage(props: PageProps<'/painel/ocorrencias/[id]'>) {
  const { id } = await props.params
  const { profile, supabase } = await requireProfile()

  // Tudo aqui é buscado pelo `id` da URL, não pela linha da manifestação, então
  // nada precisa esperar a consulta principal: antes a página fazia duas rodadas
  // em fila, agora faz uma. Se a manifestação não for do tenant, o RLS devolve
  // vazio em todas — as consultas a mais não revelam nada.
  const [occurrenceRow, settings, messages, events, tasks, departments, assignees, rating, attachments] =
    await Promise.all([
    supabase
      .from('occurrences')
      .select(
        `*, occurrence_types(name), categories(name), subjects(name),
         branches(name), departments(name), profiles(full_name)`,
      )
      .eq('id', id)
      .maybeSingle(),
    profile.company_id
      ? supabase
          .from('company_settings')
          .select('sla_warning_days, max_attachment_mb')
          .eq('company_id', profile.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('occurrence_messages')
      .select('id, author, body, is_internal, created_at, profiles(full_name)')
      .eq('occurrence_id', id)
      .order('created_at'),
    supabase
      .from('occurrence_events')
      .select('id, event_type, description, actor_label, created_at')
      .eq('occurrence_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('occurrence_tasks')
      // occurrence_tasks aponta para profiles duas vezes (responsável e criador),
      // então o embed precisa nomear a constraint.
      .select('id, title, status, due_on, profiles!occurrence_tasks_assignee_fk(full_name)')
      .eq('occurrence_id', id)
      .order('created_at'),
    supabase.from('departments').select('id, name').eq('status', 'ativo').order('name'),
    supabase.from('profiles').select('id, full_name').eq('status', 'ativo').order('full_name'),
    supabase.from('occurrence_ratings').select('stars, comment').eq('occurrence_id', id).maybeSingle(),
    supabase
      .from('attachments')
      .select('id, file_name, size_bytes, storage_path, uploaded_by_reporter, created_at')
      .eq('occurrence_id', id)
      .order('created_at'),
  ])

  // Sem linha aqui significa "não existe" ou "não é do seu tenant" — o RLS não
  // distingue os dois, e a interface também não deve.
  const occurrence = occurrenceRow.data
  if (!occurrence) notFound()

  const warningDays = settings.data?.sla_warning_days ?? 2
  const sla = slaState(occurrence.status, occurrence.due_at, warningDays)
  const closed = CLOSED_STATUSES.includes(occurrence.status)

  return (
    <div className="flex flex-col gap-5">
      <Link href="/painel/ocorrencias" className="text-xs text-muted underline underline-offset-4">
        ← Todas as ocorrências
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-mono text-lg font-semibold tracking-tight">{occurrence.protocol}</h1>
          <p className="mt-1 text-sm text-muted">
            Aberta em {formatDateTime(occurrence.opened_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[occurrence.status]}>{STATUS_LABEL[occurrence.status]}</Badge>
          <Badge tone={SLA_TONE[sla]}>{SLA_LABEL[sla]}</Badge>
        </div>
      </header>

      <Card className="px-5 py-4">
        <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
          <Item label="Tipo" value={occurrence.occurrence_types?.name} />
          <Item label="Categoria" value={occurrence.categories?.name} />
          <Item label="Assunto" value={occurrence.subjects?.name} />
          <Item label="Filial" value={occurrence.branches?.name} />
          <Item label="Departamento" value={occurrence.departments?.name} />
          <Item label="Responsável" value={occurrence.profiles?.full_name} />
          <Item label="Prazo" value={formatDate(occurrence.due_at)} />
          <Item
            label="Manifestante"
            value={occurrence.is_anonymous ? 'Anônimo' : (occurrence.reporter_name ?? '—')}
          />
          <Item label="Encerrada em" value={occurrence.closed_at ? formatDate(occurrence.closed_at) : '—'} />
        </dl>
      </Card>

      {!occurrence.is_anonymous &&
      (occurrence.reporter_email || occurrence.reporter_phone) ? (
        <Card className="px-5 py-4">
          <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
            <Item label="E-mail" value={occurrence.reporter_email} />
            <Item label="Telefone" value={occurrence.reporter_phone} />
            <Item label="CPF" value={occurrence.reporter_tax_id} />
          </dl>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Relato" />
        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{occurrence.description}</p>
          {occurrence.occurred_at || occurrence.occurred_location || occurrence.people_involved ? (
            <dl className="grid gap-x-6 gap-y-2 border-t border-border pt-3 text-xs sm:grid-cols-3">
              <Item label="Data do ocorrido" value={occurrence.occurred_at ? formatDate(occurrence.occurred_at) : null} />
              <Item label="Local" value={occurrence.occurred_location} />
              <Item label="Pessoas envolvidas" value={occurrence.people_involved} />
            </dl>
          ) : null}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium">Situação:</span>
        <StatusControl occurrenceId={occurrence.id} status={occurrence.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AssignPanel
          occurrenceId={occurrence.id}
          departments={departments.data ?? []}
          assignees={assignees.data ?? []}
          departmentId={occurrence.department_id}
          assigneeId={occurrence.assignee_id}
          dueAt={occurrence.due_at}
        />
        <TaskPanel
          occurrenceId={occurrence.id}
          tasks={tasks.data ?? []}
          assignees={assignees.data ?? []}
        />
      </div>

      <AttachmentPanel
        occurrenceId={occurrence.id}
        attachments={attachments.data ?? []}
        maxMb={settings.data?.max_attachment_mb ?? 10}
        extensions={ALLOWED_EXTENSIONS}
      />

      <MessagePanel
        occurrenceId={occurrence.id}
        messages={messages.data ?? []}
        isAnonymous={occurrence.is_anonymous}
        closed={closed}
      />

      <AnswerPanel
        occurrenceId={occurrence.id}
        answer={occurrence.answer}
        resolution={occurrence.resolution}
        closed={closed}
      />

      {rating.data ? (
        <Card>
          <CardHeader title="Avaliação do atendimento" />
          <div className="flex flex-col gap-2 px-5 py-4">
            <p className="text-warn" aria-label={`${rating.data.stars} de 5 estrelas`}>
              {'★'.repeat(rating.data.stars)}
              <span className="text-border">{'★'.repeat(5 - rating.data.stars)}</span>
            </p>
            {rating.data.comment ? (
              <p className="text-sm text-muted">{rating.data.comment}</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Histórico" description="Rastreabilidade completa da manifestação." />
        <ol className="flex flex-col gap-3 px-5 py-4">
          {(events.data ?? []).map((event) => (
            <li key={event.id} className="flex flex-wrap gap-3 text-xs">
              <span className="w-32 shrink-0 text-muted">{formatDateTime(event.created_at)}</span>
              <span className="flex-1">
                {event.description}
                <span className="ml-1 text-muted">— {event.actor_label}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5">{value || '—'}</dd>
    </div>
  )
}

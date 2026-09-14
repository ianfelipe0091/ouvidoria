'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth'
import { CLOSED_STATUSES, STATUS_LABEL, type OccurrenceStatus } from '@/lib/domain'
import type { Database } from '@/lib/supabase/database.types'

type Resolution = Database['public']['Enums']['occurrence_resolution']
type OccurrenceUpdate = Database['public']['Tables']['occurrences']['Update']

export type ActionResult = { error?: string }

/**
 * Toda ação abaixo confirma a sessão e deixa o RLS decidir o alcance: um
 * `update` numa ocorrência de outra empresa simplesmente não atinge linha
 * alguma. Server Actions são alcançáveis por POST direto, então a autorização
 * nunca pode depender de a interface ter escondido o botão.
 */
async function session(occurrenceId: string) {
  const { profile, supabase } = await requireProfile()
  const { data: occurrence } = await supabase
    .from('occurrences')
    .select('id, company_id, status, protocol, first_response_at')
    .eq('id', occurrenceId)
    .maybeSingle()

  return { profile, supabase, occurrence }
}

/** Acrescenta um item à timeline. A trilha é o registro de rastreabilidade. */
async function logEvent(
  supabase: Awaited<ReturnType<typeof requireProfile>>['supabase'],
  companyId: string,
  occurrenceId: string,
  actorId: string,
  actorLabel: string,
  eventType: string,
  description: string,
) {
  await supabase.from('occurrence_events').insert({
    company_id: companyId,
    occurrence_id: occurrenceId,
    actor_id: actorId,
    actor_label: actorLabel,
    event_type: eventType,
    description,
  })
}

export async function updateStatus(
  occurrenceId: string,
  status: OccurrenceStatus,
): Promise<ActionResult> {
  const { profile, supabase, occurrence } = await session(occurrenceId)
  if (!occurrence) return { error: 'Ocorrência não encontrada.' }

  // O banco exige closed_at coerente com o status; encerrar pela troca simples
  // de status precisa carimbar a data junto.
  const closing = CLOSED_STATUSES.includes(status)
  const { error } = await supabase
    .from('occurrences')
    .update({
      status,
      closed_at: closing ? new Date().toISOString() : null,
    })
    .eq('id', occurrenceId)

  if (error) return { error: error.message }

  await logEvent(
    supabase, occurrence.company_id, occurrenceId, profile.id, profile.full_name,
    'status_alterado', `Status alterado para ${STATUS_LABEL[status]}.`,
  )
  revalidatePath(`/painel/ocorrencias/${occurrenceId}`)
  return {}
}

export async function assignOccurrence(
  occurrenceId: string,
  input: { departmentId: string | null; assigneeId: string | null; dueAt: string | null },
): Promise<ActionResult> {
  const { profile, supabase, occurrence } = await session(occurrenceId)
  if (!occurrence) return { error: 'Ocorrência não encontrada.' }

  const patch: OccurrenceUpdate = {
    department_id: input.departmentId,
    assignee_id: input.assigneeId,
  }
  if (input.dueAt) patch.due_at = new Date(`${input.dueAt}T23:59:59`).toISOString()
  // Encaminhar move o fluxo adiante, mas nunca reabre o que já foi encerrado.
  if (occurrence.status === 'recebida') patch.status = 'em_tratamento'

  const { error } = await supabase.from('occurrences').update(patch).eq('id', occurrenceId)
  if (error) return { error: error.message }

  const [department, assignee] = await Promise.all([
    input.departmentId
      ? supabase.from('departments').select('name').eq('id', input.departmentId).maybeSingle()
      : Promise.resolve({ data: null }),
    input.assigneeId
      ? supabase.from('profiles').select('full_name').eq('id', input.assigneeId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const target = [department.data?.name, assignee.data?.full_name].filter(Boolean).join(' — ')
  await logEvent(
    supabase, occurrence.company_id, occurrenceId, profile.id, profile.full_name,
    'encaminhada', target ? `Encaminhada para ${target}.` : 'Encaminhamento atualizado.',
  )
  revalidatePath(`/painel/ocorrencias/${occurrenceId}`)
  return {}
}

export async function postMessage(
  occurrenceId: string,
  body: string,
  isInternal: boolean,
): Promise<ActionResult> {
  const { profile, supabase, occurrence } = await session(occurrenceId)
  if (!occurrence) return { error: 'Ocorrência não encontrada.' }
  if (!body.trim()) return { error: 'A mensagem não pode ficar em branco.' }

  const { error } = await supabase.from('occurrence_messages').insert({
    company_id: occurrence.company_id,
    occurrence_id: occurrenceId,
    author: 'operador',
    author_id: profile.id,
    body: body.trim(),
    is_internal: isInternal,
  })
  if (error) return { error: error.message }

  // O primeiro contato com o manifestante marca o tempo de primeira resposta,
  // que é o indicador que a ouvidoria realmente acompanha. Nota interna não conta.
  if (!isInternal && !occurrence.first_response_at) {
    await supabase
      .from('occurrences')
      .update({ first_response_at: new Date().toISOString() })
      .eq('id', occurrenceId)
  }

  await logEvent(
    supabase, occurrence.company_id, occurrenceId, profile.id, profile.full_name,
    isInternal ? 'nota_interna' : 'mensagem_enviada',
    isInternal ? 'Nota interna registrada.' : 'Mensagem enviada ao manifestante.',
  )
  revalidatePath(`/painel/ocorrencias/${occurrenceId}`)
  return {}
}

export async function answerOccurrence(
  occurrenceId: string,
  input: { answer: string; resolution: Resolution | null; closingReason: string; close: boolean },
): Promise<ActionResult> {
  const { profile, supabase, occurrence } = await session(occurrenceId)
  if (!occurrence) return { error: 'Ocorrência não encontrada.' }
  if (!input.answer.trim()) return { error: 'Escreva a resposta ao manifestante.' }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('occurrences')
    .update({
      answer: input.answer.trim(),
      resolution: input.resolution,
      closing_reason: input.closingReason.trim() || null,
      answered_at: now,
      first_response_at: occurrence.first_response_at ?? now,
      status: input.close ? 'encerrada' : 'respondida',
      closed_at: input.close ? now : null,
    })
    .eq('id', occurrenceId)

  if (error) return { error: error.message }

  await logEvent(
    supabase, occurrence.company_id, occurrenceId, profile.id, profile.full_name,
    input.close ? 'encerrada' : 'respondida',
    input.close ? 'Resposta enviada e manifestação encerrada.' : 'Resposta enviada ao manifestante.',
  )
  revalidatePath(`/painel/ocorrencias/${occurrenceId}`)
  return {}
}

export async function createTask(
  occurrenceId: string,
  input: { title: string; assigneeId: string | null; dueOn: string | null },
): Promise<ActionResult> {
  const { profile, supabase, occurrence } = await session(occurrenceId)
  if (!occurrence) return { error: 'Ocorrência não encontrada.' }
  if (!input.title.trim()) return { error: 'Descreva a ação.' }

  const { error } = await supabase.from('occurrence_tasks').insert({
    company_id: occurrence.company_id,
    occurrence_id: occurrenceId,
    title: input.title.trim(),
    assignee_id: input.assigneeId,
    due_on: input.dueOn,
    created_by: profile.id,
  })
  if (error) return { error: error.message }

  revalidatePath(`/painel/ocorrencias/${occurrenceId}`)
  return {}
}

export async function completeTask(taskId: string, occurrenceId: string): Promise<ActionResult> {
  const { supabase } = await requireProfile()
  // completed_at e status precisam mudar juntos: há CHECK no banco ligando os dois.
  const { error } = await supabase
    .from('occurrence_tasks')
    .update({ status: 'concluida', completed_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) return { error: error.message }
  revalidatePath(`/painel/ocorrencias/${occurrenceId}`)
  return {}
}

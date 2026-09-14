'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth'
import { CLOSED_STATUSES, STATUS_LABEL, type OccurrenceStatus } from '@/lib/domain'
import { BUCKET, storagePath, validateUpload } from '@/lib/attachments'
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

/**
 * Envia anexos pelo painel.
 *
 * Usa o cliente do usuário logado, não o administrativo: as políticas do
 * Storage exigem que o caminho comece pelo company_id de quem envia, então o
 * próprio RLS impede gravar na pasta de outra empresa.
 */
export async function uploadAttachments(
  occurrenceId: string,
  form: FormData,
): Promise<ActionResult> {
  const { profile, supabase, occurrence } = await session(occurrenceId)
  if (!occurrence) return { error: 'Ocorrência não encontrada.' }

  const files = form.getAll('files').filter((f): f is File => f instanceof File)
  if (!files.length) return { error: 'Selecione ao menos um arquivo.' }

  const { data: settings } = await supabase
    .from('company_settings')
    .select('max_attachment_mb')
    .eq('company_id', occurrence.company_id)
    .maybeSingle()
  const maxMb = settings?.max_attachment_mb ?? 10

  for (const file of files) {
    const check = validateUpload(file, maxMb)
    if (!check.ok) return { error: check.error }

    const path = storagePath(occurrence.company_id, occurrenceId, file.name)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) return { error: uploadError.message }

    const { error: rowError } = await supabase.from('attachments').insert({
      company_id: occurrence.company_id,
      occurrence_id: occurrenceId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: profile.id,
    })

    if (rowError) {
      await supabase.storage.from(BUCKET).remove([path])
      return { error: rowError.message }
    }
  }

  await logEvent(
    supabase, occurrence.company_id, occurrenceId, profile.id, profile.full_name,
    'anexo_enviado', `${files.length} ${files.length === 1 ? 'arquivo anexado' : 'arquivos anexados'}.`,
  )
  revalidatePath(`/painel/ocorrencias/${occurrenceId}`)
  return {}
}

/**
 * URL temporária para baixar um anexo.
 *
 * O bucket é privado, então não existe link permanente: cada download gera uma
 * URL assinada de curta duração. O RLS decide se o usuário pode ver o arquivo.
 */
export async function attachmentUrl(storagePathValue: string): Promise<{ url?: string; error?: string }> {
  const { supabase } = await requireProfile()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePathValue, 60)

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

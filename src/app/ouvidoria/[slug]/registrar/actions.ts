'use server'

import { createClient } from '@/lib/supabase/server'

export type SubmitResult =
  | { ok: true; protocol: string; trackingCode: string; dueAt: string }
  | { ok: false; error: string }

export type ManifestacaoInput = {
  slug: string
  description: string
  typeId: string | null
  branchId: string | null
  categoryId: string | null
  subjectId: string | null
  isAnonymous: boolean
  reporterName: string | null
  reporterTaxId: string | null
  reporterEmail: string | null
  reporterPhone: string | null
  reporterWhatsapp: string | null
  occurredAt: string | null
  occurredLocation: string | null
  peopleInvolved: string | null
  hasWitnesses: boolean | null
}

const nullable = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Registra a manifestação.
 *
 * Toda a validação de regra (anonimato permitido, tenant das referências,
 * prazo) vive na função do banco. Aqui só normalizamos a entrada: duplicar as
 * regras no cliente criaria duas fontes de verdade que divergem com o tempo.
 */
export async function submitManifestacao(input: ManifestacaoInput): Promise<SubmitResult> {
  if (input.description.trim().length < 10) {
    return { ok: false, error: 'Descreva o ocorrido com pelo menos 10 caracteres.' }
  }

  const supabase = await createClient()

  // Os parâmetros opcionais da função SQL já têm DEFAULT null, então omitir é
  // equivalente a enviar null — e é o que os tipos gerados esperam.
  const { data, error } = await supabase.rpc('create_manifestacao', {
    p_company_slug: input.slug,
    p_description: input.description.trim(),
    p_type_id: input.typeId ?? undefined,
    p_branch_id: input.branchId ?? undefined,
    p_category_id: input.categoryId ?? undefined,
    p_subject_id: input.subjectId ?? undefined,
    p_is_anonymous: input.isAnonymous,
    p_reporter_name: nullable(input.reporterName) ?? undefined,
    p_reporter_tax_id: nullable(input.reporterTaxId)?.replace(/\D/g, '') ?? undefined,
    p_reporter_email: nullable(input.reporterEmail) ?? undefined,
    p_reporter_phone: nullable(input.reporterPhone) ?? undefined,
    p_reporter_whatsapp: nullable(input.reporterWhatsapp) ?? undefined,
    p_occurred_at: nullable(input.occurredAt) ?? undefined,
    p_occurred_location: nullable(input.occurredLocation) ?? undefined,
    p_people_involved: nullable(input.peopleInvolved) ?? undefined,
    p_has_witnesses: input.hasWitnesses ?? undefined,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  const result = data as unknown as { protocol: string; tracking_code: string; due_at: string }
  return {
    ok: true,
    protocol: result.protocol,
    trackingCode: result.tracking_code,
    dueAt: result.due_at,
  }
}

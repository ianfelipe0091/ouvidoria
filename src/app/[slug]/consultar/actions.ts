'use server'

import { createClient } from '@/lib/supabase/server'
import type { OccurrenceResolution, OccurrenceStatus } from '@/lib/domain'

export type TrackedManifestacao = {
  protocol: string
  status: OccurrenceStatus
  opened_at: string
  due_at: string
  answered_at: string | null
  closed_at: string | null
  is_anonymous: boolean
  type: string | null
  category: string | null
  subject: string | null
  branch: string | null
  description: string
  answer: string | null
  resolution: OccurrenceResolution | null
  can_rate: boolean
  messages: Array<{ author: 'manifestante' | 'operador'; body: string; created_at: string }>
  timeline: Array<{ event_type: string; description: string; created_at: string }>
}

export type TrackResult =
  | { ok: true; data: TrackedManifestacao }
  | { ok: false; error: string }

/**
 * O erro é sempre o mesmo, seja protocolo inexistente ou código errado: a
 * função do banco não distingue os casos, para não confirmar a existência de um
 * protocolo a quem não tem o código.
 */
const GENERIC_ERROR = 'Protocolo ou código de acompanhamento inválido.'

export async function trackManifestacao(
  slug: string,
  protocol: string,
  trackingCode: string,
): Promise<TrackResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('track_manifestacao', {
    p_company_slug: slug,
    p_protocol: protocol.trim(),
    p_tracking_code: trackingCode.trim(),
  })

  if (error || !data) return { ok: false, error: GENERIC_ERROR }
  return { ok: true, data: data as unknown as TrackedManifestacao }
}

export async function replyManifestacao(
  slug: string,
  protocol: string,
  trackingCode: string,
  body: string,
): Promise<TrackResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reply_manifestacao', {
    p_company_slug: slug,
    p_protocol: protocol.trim(),
    p_tracking_code: trackingCode.trim(),
    p_body: body.trim(),
  })

  if (error) return { ok: false, error: error.message }
  // Recarrega para que a nova mensagem apareça sem um segundo passo do usuário.
  return trackManifestacao(slug, protocol, trackingCode)
}

export async function rateManifestacao(
  slug: string,
  protocol: string,
  trackingCode: string,
  stars: number,
  comment: string,
): Promise<TrackResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('rate_manifestacao', {
    p_company_slug: slug,
    p_protocol: protocol.trim(),
    p_tracking_code: trackingCode.trim(),
    p_stars: stars,
    p_comment: comment.trim() || undefined,
  })

  if (error) return { ok: false, error: error.message }
  return trackManifestacao(slug, protocol, trackingCode)
}

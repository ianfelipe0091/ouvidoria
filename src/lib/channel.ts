import 'server-only'

import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * Formato devolvido por public.get_ouvidoria_channel().
 *
 * A função retorna jsonb, então o tipo gerado é apenas `Json`. Declaramos o
 * formato aqui e ele precisa acompanhar a migration 0008 — é o único ponto do
 * código em que os dois lados podem divergir sem o compilador perceber.
 */
export type Channel = {
  company: { slug: string; name: string; logo_url: string | null }
  branding: {
    primary_color: string
    secondary_color: string
    intro_text: string | null
    privacy_policy_text: string | null
  }
  options: {
    allow_anonymous: boolean
    allow_attachments: boolean
    allow_rating: boolean
    max_attachment_mb: number
  }
  types: Array<{ id: string; name: string; slug: string }>
  branches: Array<{ id: string; name: string; city: string | null }>
  categories: Array<{
    id: string
    name: string
    subjects: Array<{ id: string; name: string }>
  }>
}

/** Carrega o canal ou devolve 404. Empresa suspensa não tem canal no ar. */
export async function getChannel(slug: string): Promise<Channel> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_ouvidoria_channel', { p_company_slug: slug })

  if (error || !data) {
    notFound()
  }

  return data as unknown as Channel
}

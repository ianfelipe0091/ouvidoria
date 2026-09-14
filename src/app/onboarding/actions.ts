'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { requireCompanyAdmin } from '@/lib/auth'

export type Result = { error?: string; ok?: boolean }

const text = (form: FormData, key: string) => {
  const value = String(form.get(key) ?? '').trim()
  return value || null
}

/** Etapa 1 — identidade do canal público. */
export async function saveIdentity(_prev: Result, form: FormData): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()

  const { error } = await supabase
    .from('company_settings')
    .update({
      channel_name: text(form, 'channel_name'),
      logo_url: text(form, 'logo_url'),
      primary_color: text(form, 'primary_color') ?? '#1f2937',
      secondary_color: text(form, 'secondary_color') ?? '#4b5563',
      intro_text: text(form, 'intro_text'),
    })
    .eq('company_id', profile.company_id!)

  if (error) return { error: error.message }
  revalidatePath('/onboarding')
  redirect('/onboarding?etapa=unidade')
}

/**
 * Etapa 2 — a primeira unidade.
 *
 * A matriz já existe: o provisionamento a cria junto com a empresa. Aqui ela é
 * configurada, não recriada — cadastrar outra deixaria duas matrizes, e o banco
 * só admite uma.
 */
export async function saveBranch(_prev: Result, form: FormData): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()
  const name = text(form, 'name')
  if (!name) return { error: 'Informe o nome da unidade.' }

  const { data: headquarters } = await supabase
    .from('branches')
    .select('id')
    .eq('company_id', profile.company_id!)
    .eq('is_headquarters', true)
    .maybeSingle()

  const values = {
    name,
    address_city: text(form, 'address_city'),
    address_state: text(form, 'address_state')?.toUpperCase().slice(0, 2) || null,
    phone: text(form, 'phone'),
    email: text(form, 'email'),
  }

  const { error } = headquarters
    ? await supabase.from('branches').update(values).eq('id', headquarters.id)
    : await supabase
        .from('branches')
        .insert({ ...values, company_id: profile.company_id!, is_headquarters: true })

  if (error) return { error: error.message }
  revalidatePath('/onboarding')
  redirect('/onboarding?etapa=pronto')
}

/** Etapa 3 — conclui e libera o painel. */
export async function finishOnboarding(): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()

  const { error } = await supabase.rpc('complete_onboarding', {
    p_company_id: profile.company_id!,
  })
  if (error) return { error: error.message }

  revalidatePath('/painel')
  redirect('/painel')
}

/** Permite adiar: obrigar a configurar antes de ver o produto afasta. */
export async function skipOnboarding(): Promise<Result> {
  return finishOnboarding()
}

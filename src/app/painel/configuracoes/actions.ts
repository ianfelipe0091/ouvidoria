'use server'

import { revalidatePath } from 'next/cache'

import { requireCompanyAdmin } from '@/lib/auth'

export type Result = { error?: string; ok?: boolean }

const text = (form: FormData, key: string) => {
  const value = String(form.get(key) ?? '').trim()
  return value || null
}

export async function saveSettings(_prev: Result, form: FormData): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()
  const companyId = profile.company_id!

  const slaDays = Number(form.get('default_sla_days')) || 10
  const warningDays = Number(form.get('sla_warning_days')) || 2

  // O banco tem CHECK exigindo aviso < prazo; validar aqui dá uma mensagem
  // legível em vez de um erro de constraint.
  if (warningDays >= slaDays) {
    return { error: 'O aviso de vencimento precisa ser menor que o prazo de resposta.' }
  }

  const { error: settingsError } = await supabase
    .from('company_settings')
    .update({
      channel_name: text(form, 'channel_name'),
      logo_url: text(form, 'logo_url'),
      primary_color: text(form, 'primary_color') ?? '#1f2937',
      secondary_color: text(form, 'secondary_color') ?? '#4b5563',
      intro_text: text(form, 'intro_text'),
      privacy_policy_text: text(form, 'privacy_policy_text'),
      notification_email: text(form, 'notification_email'),
      default_sla_days: slaDays,
      sla_warning_days: warningDays,
      allow_anonymous: form.get('allow_anonymous') === 'on',
      allow_attachments: form.get('allow_attachments') === 'on',
      allow_rating: form.get('allow_rating') === 'on',
    })
    .eq('company_id', companyId)

  if (settingsError) return { error: settingsError.message }

  const { error: companyError } = await supabase
    .from('companies')
    .update({
      trade_name: text(form, 'trade_name'),
      email: text(form, 'email') ?? '',
      phone: text(form, 'phone'),
      website: text(form, 'website'),
    })
    .eq('id', companyId)

  if (companyError) return { error: companyError.message }

  revalidatePath('/painel/configuracoes')
  return { ok: true }
}

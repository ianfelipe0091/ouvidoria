'use server'

import { revalidatePath } from 'next/cache'

import { requireCompanyAdmin } from '@/lib/auth'

export type Result = { error?: string; ok?: boolean }

const text = (form: FormData, key: string) => {
  const value = String(form.get(key) ?? '').trim()
  return value || null
}

export async function createBranch(_prev: Result, form: FormData): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()
  const name = text(form, 'name')
  if (!name) return { error: 'Informe o nome da filial.' }

  const { error } = await supabase.from('branches').insert({
    company_id: profile.company_id!,
    name,
    trade_name: text(form, 'trade_name'),
    tax_id: text(form, 'tax_id')?.replace(/\D/g, '') || null,
    internal_code: text(form, 'internal_code'),
    address_city: text(form, 'address_city'),
    address_state: text(form, 'address_state')?.toUpperCase().slice(0, 2) || null,
    phone: text(form, 'phone'),
    email: text(form, 'email'),
    contact_name: text(form, 'contact_name'),
  })

  if (error) return { error: error.message }
  revalidatePath('/painel/filiais')
  return { ok: true }
}

export async function toggleBranch(id: string, active: boolean): Promise<Result> {
  const { supabase } = await requireCompanyAdmin()
  const { error } = await supabase
    .from('branches')
    .update({ status: active ? 'ativo' : 'inativo' })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/painel/filiais')
  return { ok: true }
}

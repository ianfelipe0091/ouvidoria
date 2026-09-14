'use server'

import { revalidatePath } from 'next/cache'

import { requireCompanyAdmin } from '@/lib/auth'

export type Result = { error?: string; ok?: boolean }

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function createCategory(_prev: Result, form: FormData): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()
  const name = String(form.get('name') ?? '').trim()
  if (!name) return { error: 'Informe o nome da categoria.' }

  const { error } = await supabase
    .from('categories')
    .insert({ company_id: profile.company_id!, name })

  if (error) {
    return {
      error: error.code === '23505' ? 'Já existe uma categoria com esse nome.' : error.message,
    }
  }
  revalidatePath('/painel/categorias')
  return { ok: true }
}

export async function createSubject(categoryId: string, name: string): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()
  if (!name.trim()) return { error: 'Informe o nome do assunto.' }

  const { error } = await supabase.from('subjects').insert({
    company_id: profile.company_id!,
    category_id: categoryId,
    name: name.trim(),
  })

  if (error) {
    return { error: error.code === '23505' ? 'Esse assunto já existe.' : error.message }
  }
  revalidatePath('/painel/categorias')
  return { ok: true }
}

export async function createType(_prev: Result, form: FormData): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()
  const name = String(form.get('name') ?? '').trim()
  if (!name) return { error: 'Informe o nome do tipo.' }

  const { error } = await supabase.from('occurrence_types').insert({
    company_id: profile.company_id!,
    name,
    slug: slugify(name),
  })

  if (error) {
    return { error: error.code === '23505' ? 'Já existe um tipo com esse nome.' : error.message }
  }
  revalidatePath('/painel/categorias')
  return { ok: true }
}

/**
 * Tipos e categorias são desativados, nunca apagados: excluir quebraria a
 * classificação de manifestações já registradas.
 */
export async function toggleRecord(
  table: 'occurrence_types' | 'categories' | 'subjects',
  id: string,
  active: boolean,
): Promise<Result> {
  const { supabase } = await requireCompanyAdmin()
  const { error } = await supabase
    .from(table)
    .update({ status: active ? 'ativo' : 'inativo' })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/painel/categorias')
  return { ok: true }
}

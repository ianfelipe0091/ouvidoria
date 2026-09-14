'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompanyAdmin } from '@/lib/auth'
import type { Database } from '@/lib/supabase/database.types'

export type Result = { error?: string; ok?: boolean; password?: string }

type AppRole = Database['public']['Enums']['app_role']

const ASSIGNABLE: AppRole[] = ['company_admin', 'ombudsman', 'manager', 'area_responsible']

/** Senha inicial legível, entregue uma vez ao administrador. */
function initialPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

/**
 * Cria o usuário no Auth e o perfil correspondente.
 *
 * Exige a chave secreta: criar contas é uma operação administrativa da Auth
 * API, fora do alcance do RLS. Por isso a checagem de permissão acontece antes,
 * aqui no servidor — o cliente administrativo ignora RLS por definição.
 */
export async function createUser(_prev: Result, form: FormData): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()

  const fullName = String(form.get('full_name') ?? '').trim()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const role = String(form.get('role') ?? '') as AppRole

  if (!fullName || !email) return { error: 'Informe nome e e-mail.' }
  if (!ASSIGNABLE.includes(role)) return { error: 'Perfil de acesso inválido.' }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return {
      error:
        'SUPABASE_SECRET_KEY não está configurada. Ela é necessária para criar contas de acesso.',
    }
  }

  const password = initialPassword()
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !created.user) {
    return { error: authError?.message ?? 'Não foi possível criar a conta.' }
  }

  // O perfil é criado pelo cliente do usuário logado, não pelo administrativo:
  // assim o RLS confirma que o admin só cria gente na própria empresa.
  const { error: profileError } = await supabase.from('profiles').insert({
    id: created.user.id,
    company_id: profile.company_id!,
    full_name: fullName,
    email,
    role,
    phone: String(form.get('phone') ?? '').trim() || null,
    job_title: String(form.get('job_title') ?? '').trim() || null,
    department_id: String(form.get('department_id') ?? '') || null,
  })

  if (profileError) {
    // Sem perfil o usuário do Auth ficaria órfão, capaz de logar e não ver nada.
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: profileError.message }
  }

  revalidatePath('/painel/usuarios')
  return { ok: true, password }
}

export async function toggleUser(id: string, active: boolean): Promise<Result> {
  const { profile, supabase } = await requireCompanyAdmin()
  if (id === profile.id) return { error: 'Você não pode desativar a própria conta.' }

  const { error } = await supabase
    .from('profiles')
    .update({ status: active ? 'ativo' : 'inativo' })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/painel/usuarios')
  return { ok: true }
}

'use server'

import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { checkPassword, digits, isValidCnpj, isValidEmail } from '@/lib/validation'

export type SignUpState = { error?: string }

/**
 * Cadastro self-service de uma nova empresa.
 *
 * Roda no servidor com a chave secreta porque cria conta no Auth e provisiona
 * um tenant inteiro — nada disso pode ser feito pelo papel `anon`. Em troca, é
 * o único ponto do sistema em que uma requisição anônima aciona a chave
 * secreta, então toda a validação acontece aqui antes de qualquer escrita.
 */
export async function signUp(_prev: SignUpState, form: FormData): Promise<SignUpState> {
  const legalName = String(form.get('legal_name') ?? '').trim()
  const tradeName = String(form.get('trade_name') ?? '').trim()
  const taxId = digits(String(form.get('tax_id') ?? ''))
  const contactName = String(form.get('contact_name') ?? '').trim()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const phone = String(form.get('phone') ?? '').trim()
  const password = String(form.get('password') ?? '')
  const confirm = String(form.get('password_confirm') ?? '')
  const planSlug = String(form.get('plan') ?? 'basic')

  if (!legalName) return { error: 'Informe a razão social da empresa.' }
  if (!isValidCnpj(taxId)) return { error: 'CNPJ inválido. Confira os dígitos.' }
  if (!contactName) return { error: 'Informe o nome do responsável.' }
  if (!isValidEmail(email)) return { error: 'Informe um e-mail válido.' }

  const passwordCheck = checkPassword(password)
  if (!passwordCheck.ok) return { error: passwordCheck.message }
  if (password !== confirm) return { error: 'As senhas não conferem.' }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Cadastro indisponível no momento. Tente novamente em instantes.' }
  }

  // CNPJ é único no banco; conferir antes permite uma mensagem clara em vez de
  // um erro de constraint depois de já ter criado a conta de acesso.
  const { data: existing } = await admin
    .from('companies')
    .select('id')
    .eq('tax_id', taxId)
    .maybeSingle()

  if (existing) {
    return { error: 'Já existe uma conta para este CNPJ. Use "Entrar" ou fale com o responsável.' }
  }

  const { data: slugData, error: slugError } = await admin.rpc('suggest_company_slug', {
    p_name: tradeName || legalName,
  })
  if (slugError) return { error: 'Não foi possível preparar o endereço do canal.' }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    // Confirmado na hora: ainda não há provedor de e-mail configurado, então
    // exigir confirmação deixaria todo cadastro preso sem saída.
    email_confirm: true,
  })

  if (authError || !created.user) {
    const duplicate = authError?.message?.toLowerCase().includes('already')
    return {
      error: duplicate
        ? 'Este e-mail já tem cadastro. Use "Entrar" para acessar.'
        : 'Não foi possível criar a conta de acesso.',
    }
  }

  const { error: provisionError } = await admin.rpc('provision_company', {
    p_slug: slugData as string,
    p_legal_name: legalName,
    p_trade_name: tradeName || legalName,
    p_tax_id: taxId,
    p_email: email,
    p_plan_slug: planSlug,
    p_admin_user_id: created.user.id,
    p_admin_name: contactName,
    p_admin_email: email,
    p_phone: phone || undefined,
    p_contact_name: contactName,
    p_contact_phone: phone || undefined,
  })

  if (provisionError) {
    // Conta de acesso sem empresa é um usuário que entra e não vê nada.
    // Desfazer é melhor que deixar o resto pela metade.
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: `Não foi possível criar o ambiente: ${provisionError.message}` }
  }

  // Entra já logado: pedir para fazer login logo após criar a conta é atrito
  // sem contrapartida.
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) redirect('/entrar')

  redirect('/onboarding')
}

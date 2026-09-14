/**
 * Cria o administrador da plataforma — o nível 1, que enxerga todas as
 * empresas clientes.
 *
 * É o único perfil que não pertence a um tenant, e por isso não pode ser criado
 * pela interface: não existe empresa a partir da qual convidá-lo. Rode uma vez,
 * logo após o primeiro deploy.
 *
 * Uso:
 *   ADMIN_EMAIL=voce@empresa.com ADMIN_PASSWORD='...' node scripts/create-platform-admin.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch { /* em produção as variáveis vêm do ambiente */ }

const { NEXT_PUBLIC_SUPABASE_URL: URL_, SUPABASE_SECRET_KEY: SECRET } = process.env
const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME ?? 'Administrador da plataforma'

if (!URL_ || !SECRET) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.')
  process.exit(1)
}
if (!email || !password) {
  console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD.')
  process.exit(1)
}
if (password.length < 12) {
  console.error('Use uma senha de pelo menos 12 caracteres.')
  process.exit(1)
}

const admin = createClient(URL_, SECRET, { auth: { persistSession: false } })

const { data: existing } = await admin
  .from('profiles')
  .select('email')
  .eq('role', 'platform_admin')
  .limit(1)

if (existing?.length) {
  console.error(`Já existe um administrador da plataforma (${existing[0].email}).`)
  console.error('Para criar outro, use o painel da plataforma ou remova esta checagem.')
  process.exit(1)
}

const { data: user, error: userError } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
})
if (userError) {
  console.error(`Não foi possível criar a conta: ${userError.message}`)
  process.exit(1)
}

// company_id fica nulo: é a restrição profiles_tenant_scope que garante que
// somente o platform_admin vive fora de uma empresa.
const { error: profileError } = await admin.from('profiles').insert({
  id: user.user.id,
  company_id: null,
  full_name: name,
  email,
  role: 'platform_admin',
})

if (profileError) {
  await admin.auth.admin.deleteUser(user.user.id)
  console.error(`Não foi possível criar o perfil: ${profileError.message}`)
  process.exit(1)
}

console.log(`Administrador da plataforma criado: ${email}`)
console.log('Acesse /entrar e depois /master.')

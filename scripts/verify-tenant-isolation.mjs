/**
 * Verificação de isolamento multi-tenant.
 *
 * Cria duas empresas descartáveis com usuários reais, exercita as políticas de
 * RLS com os JWTs de cada uma e apaga tudo ao final. O objetivo é provar, com
 * requisições de verdade, que "uma empresa jamais acessa dados de outra" — e
 * não apenas confiar na leitura das policies.
 *
 * Uso:
 *   SUPABASE_SECRET_KEY=... node scripts/verify-tenant-isolation.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Lê .env.local sem dependência extra: o script roda fora do bundle do Next.
function loadEnvLocal() {
  try {
    for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch {
    // Sem .env.local: as variáveis precisam vir do ambiente.
  }
}
loadEnvLocal()

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY

if (!URL_ || !PUBLISHABLE || !SECRET) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY.')
  process.exit(1)
}

const admin = createClient(URL_, SECRET, { auth: { persistSession: false } })
const anon = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false } })

let passed = 0
let failed = 0
const cleanup = []

function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FALHA ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function createUser(email) {
  const password = `Test!${Math.random().toString(36).slice(2)}Aa1`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  cleanup.push(() => admin.auth.admin.deleteUser(data.user.id))
  return { id: data.user.id, email, password }
}

async function signIn(user) {
  const client = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error) throw new Error(`signIn ${user.email}: ${error.message}`)
  return client
}

async function main() {
  const tag = Math.random().toString(36).slice(2, 8)

  // ---------------------------------------------------------------- setup ---
  const adminA = await createUser(`admin-a-${tag}@exemplo.test`)
  const adminB = await createUser(`admin-b-${tag}@exemplo.test`)
  const areaA = await createUser(`area-a-${tag}@exemplo.test`)

  const { data: companyA, error: errA } = await admin.rpc('provision_company', {
    p_slug: `empresa-a-${tag}`,
    p_legal_name: 'Empresa A LTDA',
    p_tax_id: String(10000000000000 + Math.floor(Math.random() * 8999999999999)),
    p_email: `contato-a-${tag}@exemplo.test`,
    p_admin_user_id: adminA.id,
    p_admin_name: 'Admin A',
    p_admin_email: adminA.email,
  })
  if (errA) throw new Error(`provision A: ${errA.message}`)

  const { data: companyB, error: errB } = await admin.rpc('provision_company', {
    p_slug: `empresa-b-${tag}`,
    p_legal_name: 'Empresa B LTDA',
    p_tax_id: String(20000000000000 + Math.floor(Math.random() * 8999999999999)),
    p_email: `contato-b-${tag}@exemplo.test`,
    p_admin_user_id: adminB.id,
    p_admin_name: 'Admin B',
    p_admin_email: adminB.email,
  })
  if (errB) throw new Error(`provision B: ${errB.message}`)

  cleanup.push(() => admin.from('companies').delete().eq('id', companyA))
  cleanup.push(() => admin.from('companies').delete().eq('id', companyB))

  // Manifestação em cada empresa, pelo canal público.
  const { data: subA, error: subErrA } = await anon.rpc('create_manifestacao', {
    p_company_slug: `empresa-a-${tag}`,
    p_description: 'Relato de teste pertencente exclusivamente à Empresa A.',
    p_is_anonymous: true,
  })
  if (subErrA) throw new Error(`create A: ${subErrA.message}`)

  const { data: subB, error: subErrB } = await anon.rpc('create_manifestacao', {
    p_company_slug: `empresa-b-${tag}`,
    p_description: 'Relato de teste pertencente exclusivamente à Empresa B.',
    p_is_anonymous: true,
  })
  if (subErrB) throw new Error(`create B: ${subErrB.message}`)

  const clientA = await signIn(adminA)
  const clientB = await signIn(adminB)

  const { data: occA } = await admin.from('occurrences').select('id, protocol, company_id').eq('company_id', companyA).single()
  const { data: occB } = await admin.from('occurrences').select('id, protocol, company_id').eq('company_id', companyB).single()
  const { data: branchB } = await admin.from('branches').select('id').eq('company_id', companyB).single()

  console.log('\nIsolamento entre empresas')

  // 1. Cada admin enxerga apenas as ocorrências da sua empresa.
  const { data: seenByA } = await clientA.from('occurrences').select('id, company_id')
  check('admin A vê somente ocorrências da empresa A',
    seenByA?.length === 1 && seenByA[0].company_id === companyA,
    `viu ${seenByA?.length ?? 0}`)

  const { data: seenByB } = await clientB.from('occurrences').select('id, company_id')
  check('admin B vê somente ocorrências da empresa B',
    seenByB?.length === 1 && seenByB[0].company_id === companyB,
    `viu ${seenByB?.length ?? 0}`)

  // 2. Buscar diretamente pelo id da outra empresa não devolve nada.
  const { data: crossRead } = await clientA.from('occurrences').select('id').eq('id', occB.id)
  check('admin A não lê ocorrência da empresa B nem pelo id', (crossRead ?? []).length === 0)

  // 3. Empresas: A não enxerga o cadastro de B.
  const { data: companiesSeenByA } = await clientA.from('companies').select('id')
  check('admin A vê apenas a própria empresa',
    companiesSeenByA?.length === 1 && companiesSeenByA[0].id === companyA)

  // 4. A não altera dados de B.
  const { error: crossUpdate } = await clientA.from('companies').update({ trade_name: 'invadida' }).eq('id', companyB)
  const { data: bAfter } = await admin.from('companies').select('trade_name').eq('id', companyB).single()
  check('admin A não consegue alterar a empresa B', bAfter.trade_name !== 'invadida',
    crossUpdate ? `erro: ${crossUpdate.message}` : 'update silenciosamente sem efeito')

  // 5. Perfis de outra empresa não vazam.
  const { data: profilesSeenByA } = await clientA.from('profiles').select('id, company_id')
  check('admin A não vê perfis da empresa B',
    (profilesSeenByA ?? []).every((p) => p.company_id === companyA))

  console.log('\nIntegridade referencial entre tenants')

  // 6. Não dá para criar ocorrência da empresa A apontando para filial de B.
  const { error: fkError } = await clientA.from('occurrences').insert({
    company_id: companyA,
    protocol: `OUV-2026-999${tag.slice(0, 3)}`,
    tracking_code_hash: 'x',
    branch_id: branchB.id,
    description: 'Tentativa de vincular filial de outra empresa.',
    due_at: new Date(Date.now() + 86400000).toISOString(),
  })
  check('ocorrência de A não aceita filial de B (FK composta)', Boolean(fkError),
    fkError ? '' : 'insert foi aceito')

  console.log('\nEscalação de privilégio')

  // 7. Usuário comum não promove a si mesmo.
  await admin.from('profiles').insert({
    id: areaA.id,
    company_id: companyA,
    full_name: 'Responsável de Área',
    email: areaA.email,
    role: 'area_responsible',
  })
  const clientArea = await signIn(areaA)
  const { error: escalateError } = await clientArea.from('profiles')
    .update({ role: 'company_admin' }).eq('id', areaA.id)
  const { data: areaAfter } = await admin.from('profiles').select('role').eq('id', areaA.id).single()
  check('responsável de área não vira company_admin sozinho', areaAfter.role === 'area_responsible',
    escalateError ? '' : 'update aceito')

  // 8. Responsável de área não enxerga ocorrência que não é da sua área.
  const { data: areaSees } = await clientArea.from('occurrences').select('id')
  check('responsável de área não vê ocorrência de outro departamento', (areaSees ?? []).length === 0,
    `viu ${areaSees?.length ?? 0}`)

  console.log('\nCanal público (papel anon)')

  // 9. anon não alcança tabela nenhuma.
  for (const table of ['occurrences', 'companies', 'profiles', 'audit_logs', 'protocol_counters']) {
    const { data, error } = await anon.from(table).select('*').limit(1)
    check(`anon não lê ${table}`, Boolean(error) || (data ?? []).length === 0,
      error ? '' : 'retornou linhas')
  }

  // 10. Consulta por protocolo exige o código correto.
  const { error: wrongCode } = await anon.rpc('track_manifestacao', {
    p_company_slug: `empresa-a-${tag}`,
    p_protocol: subA.protocol,
    p_tracking_code: 'AAAA-BBBB-CCCC-DDDD',
  })
  check('consulta com código errado é recusada', Boolean(wrongCode))

  const { data: tracked, error: rightCode } = await anon.rpc('track_manifestacao', {
    p_company_slug: `empresa-a-${tag}`,
    p_protocol: subA.protocol,
    p_tracking_code: subA.tracking_code,
  })
  check('consulta com código correto funciona',
    !rightCode && tracked?.protocol === subA.protocol,
    rightCode?.message ?? '')

  // 11. O protocolo é sequencial por empresa, então "OUV-2026-000001" existe nas
  //     duas. Usar o código da empresa B no canal da empresa A não pode abrir
  //     nada — foi exatamente aqui que a primeira versão vazava entre tenants.
  const { error: mixed } = await anon.rpc('track_manifestacao', {
    p_company_slug: `empresa-a-${tag}`,
    p_protocol: subA.protocol,
    p_tracking_code: subB.tracking_code,
  })
  check('código da empresa B não abre manifestação no canal da empresa A', Boolean(mixed))

  // 12. E o par válido de A também não funciona no canal de B.
  const { error: wrongChannel } = await anon.rpc('track_manifestacao', {
    p_company_slug: `empresa-b-${tag}`,
    p_protocol: subA.protocol,
    p_tracking_code: subA.tracking_code,
  })
  check('par válido de A é recusado no canal de B', Boolean(wrongChannel))

  console.log('\nRegras de domínio')

  // 12. Manifestação anônima não guarda dado pessoal.
  const { data: anonRow } = await admin.from('occurrences')
    .select('is_anonymous, reporter_name, reporter_email').eq('id', occA.id).single()
  check('manifestação anônima não armazena dados do manifestante',
    anonRow.is_anonymous && !anonRow.reporter_name && !anonRow.reporter_email)

  // 13. Protocolo segue o formato acordado e é sequencial por empresa.
  check('protocolo no formato OUV-AAAA-NNNNNN', /^OUV-\d{4}-\d{6}$/.test(occA.protocol), occA.protocol)
  check('numeração é independente por empresa', occA.protocol === occB.protocol,
    `A=${occA.protocol} B=${occB.protocol}`)

  // 14. Auditoria registrou a criação.
  const { data: audit } = await admin.from('audit_logs')
    .select('action, entity').eq('company_id', companyA).eq('entity', 'occurrences')
  check('auditoria registrou a criação da ocorrência', (audit ?? []).length > 0)
}

try {
  await main()
} catch (error) {
  failed++
  console.error('\nErro durante a verificação:', error.message)
} finally {
  for (const fn of cleanup.reverse()) {
    try { await fn() } catch { /* melhor esforço */ }
  }
  console.log(`\n${passed} verificações passaram, ${failed} falharam.`)
  process.exit(failed === 0 ? 0 : 1)
}

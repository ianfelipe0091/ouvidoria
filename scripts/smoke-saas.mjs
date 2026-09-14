/**
 * Teste de fumaça do fluxo comercial, num navegador real.
 *
 * Percorre o caminho de um cliente novo: site público → criar conta → ambiente
 * provisionado → onboarding → painel. E confirma o que sustenta o modelo
 * multiempresa: a conta recém-criada não enxerga nada da outra empresa.
 *
 * Cria uma empresa descartável e a remove ao final.
 *
 * Uso: BASE_URL=http://127.0.0.1:3000 node scripts/smoke-saas.mjs
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch { /* variáveis podem vir do ambiente */ }

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const PROXY = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(BASE)
  ? undefined
  : process.env.HTTPS_PROXY ?? process.env.https_proxy

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
)

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ok   ${name}`) }
  else { failed++; console.log(`  FALHA ${name}${detail ? ` — ${detail}` : ''}`) }
}

/** CNPJ com dígitos verificadores válidos — o cadastro recusa qualquer outro. */
function generateCnpj() {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10))
  const digit = (nums) => {
    let sum = 0
    let weight = nums.length - 7
    for (const n of nums) {
      sum += n * weight--
      if (weight < 2) weight = 9
    }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  base.push(digit(base))
  base.push(digit(base))
  return base.join('')
}

const tag = Math.random().toString(36).slice(2, 8)
const CNPJ = generateCnpj()
const EMAIL = `fundador-${tag}@exemplo.test`
const SENHA = `Teste-${tag}-Plataforma`
const EMPRESA = `Transportes Aurora ${tag.toUpperCase()}`

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  ...(PROXY ? { proxy: { server: PROXY } } : {}),
})
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

const erros = []
page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
page.on('pageerror', (e) => erros.push(String(e)))

let companyId = null

try {
  console.log('\nSite público')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const home = await page.textContent('body')
  check('landing identifica a plataforma como SaaS', home.includes('Plataforma SaaS'))
  check('landing lista os planos do banco',
    home.includes('Basic') && home.includes('Professional') && home.includes('Enterprise'))
  check('landing mostra preço', /R\$\s?\d/.test(home))
  check('landing oferece criar conta', home.includes('Criar conta'))

  console.log('\nCadastro de nova empresa')
  await page.goto(`${BASE}/criar-conta?plano=professional`, { waitUntil: 'networkidle' })
  check('cadastro mostra o plano escolhido', (await page.textContent('body')).includes('Professional'))

  // CNPJ inválido precisa ser barrado antes de criar qualquer coisa.
  await page.getByLabel('CNPJ', { exact: false }).fill('11111111111111')
  await page.waitForTimeout(300)
  check('CNPJ inválido é sinalizado',
    (await page.textContent('body')).includes('CNPJ inválido'))

  await page.getByLabel('Razão social').fill(`${EMPRESA} LTDA`)
  await page.getByLabel('Nome fantasia').fill(EMPRESA)
  await page.getByLabel('CNPJ', { exact: false }).fill(CNPJ)
  await page.getByLabel('Nome completo').fill('Helena Duarte')
  await page.getByLabel('E-mail', { exact: false }).fill(EMAIL)
  await page.getByLabel('Senha', { exact: true }).fill(SENHA)
  await page.getByLabel('Confirmar senha').fill(SENHA)
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await page.waitForURL('**/onboarding**', { timeout: 40000 })
  check('cadastro leva ao onboarding já autenticado', true)

  const { data: company } = await admin
    .from('companies').select('id, slug, onboarded_at').eq('tax_id', CNPJ).maybeSingle()
  companyId = company?.id ?? null
  check('empresa foi provisionada', Boolean(company))

  const { data: sub } = await admin
    .from('subscriptions').select('status, plans(name)').eq('company_id', companyId).maybeSingle()
  check('assinatura criada em avaliação no plano escolhido',
    sub?.status === 'trial' && sub?.plans?.name === 'Professional',
    `${sub?.status} / ${sub?.plans?.name}`)

  const { data: seeded } = await admin
    .from('occurrence_types').select('id').eq('company_id', companyId)
  check('taxonomia padrão criada', (seeded ?? []).length === 8, `${seeded?.length} tipos`)

  console.log('\nOnboarding')
  await page.getByLabel('Nome exibido no canal').fill(`Ouvidoria ${EMPRESA}`)
  await page.getByLabel('Texto de apresentação').fill('Canal de escuta da Transportes Aurora.')
  await page.getByRole('button', { name: 'Continuar' }).click()

  await page.waitForURL('**/onboarding?etapa=unidade', { timeout: 20000 })
  await page.getByLabel('Nome da unidade').fill('Matriz — Curitiba')
  await page.getByLabel('Cidade').fill('Curitiba')
  await page.getByLabel('UF').fill('PR')
  await page.getByRole('button', { name: 'Continuar' }).click()

  await page.waitForURL('**/onboarding?etapa=pronto', { timeout: 20000 })
  const pronto = await page.textContent('body')
  check('última etapa mostra o endereço do canal', pronto.includes(`/ouvidoria/${company.slug}`))

  await page.getByRole('button', { name: 'Ir para o painel' }).click()
  await page.waitForURL('**/painel', { timeout: 20000 })
  check('onboarding concluído leva ao painel', page.url().endsWith('/painel'))

  const painel = await page.textContent('body')
  check('painel identifica a empresa', painel.includes(EMPRESA))
  check('painel mostra o plano contratado', painel.includes('Professional'))
  check('painel avisa da avaliação', painel.includes('Avaliação gratuita'))

  console.log('\nIsolamento entre empresas')
  await page.goto(`${BASE}/painel/ocorrencias`, { waitUntil: 'networkidle' })
  const lista = await page.textContent('body')
  check('empresa nova não vê manifestações de outra empresa',
    lista.includes('Nenhuma manifestação encontrada'))
  check('nenhum protocolo de outra empresa aparece', !/OUV-\d{4}-\d{6}/.test(lista))

  await page.goto(`${BASE}/painel/filiais`, { waitUntil: 'networkidle' })
  const filiais = await page.textContent('body')
  check('vê apenas a própria matriz', filiais.includes('Matriz — Curitiba'))
  check('não vê filiais de outra empresa', !filiais.includes('Filial Recife'))

  console.log('\nPlano e limites')
  await page.goto(`${BASE}/painel/plano`, { waitUntil: 'networkidle' })
  const plano = await page.textContent('body')
  check('mostra o plano atual', plano.includes('Professional'))
  check('mostra uso dos limites', plano.includes('Filiais ativas'))
  check('oferece mudança de plano', plano.includes('Mudar para'))

  await page.getByRole('button', { name: 'Mudar para Basic' }).click()
  await page.getByText('Plano alterado para Basic').waitFor({ timeout: 20000 })
  check('upgrade/downgrade aplica na hora', true)

  const { data: after } = await admin
    .from('subscriptions').select('status, plans(name)').eq('company_id', companyId).maybeSingle()
  check('assinatura deixa a avaliação ao contratar',
    after?.status === 'ativa' && after?.plans?.name === 'Basic',
    `${after?.status} / ${after?.plans?.name}`)

  console.log('\nCanal público da nova empresa')
  await context.clearCookies()
  await page.goto(`${BASE}/ouvidoria/${company.slug}`, { waitUntil: 'networkidle' })
  const canal = await page.textContent('body')
  check('canal da nova empresa está no ar', canal.includes(`Ouvidoria ${EMPRESA}`))
  check('canal usa o texto configurado no onboarding',
    canal.includes('Canal de escuta da Transportes Aurora.'))
  check('canal indica que é operado pela plataforma', canal.includes('Canal operado por'))

  check('sem erros de console', erros.length === 0, erros.slice(0, 3).join(' | '))
} catch (error) {
  failed++
  console.error('\nErro durante o teste:', error.message.split('\n').slice(0, 6).join('\n'))
} finally {
  await browser.close()
  if (companyId) {
    await admin.from('companies').delete().eq('id', companyId)
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 })
    const user = users?.users.find((u) => u.email === EMAIL)
    if (user) await admin.auth.admin.deleteUser(user.id)
  }
  console.log(`\n${passed} verificações passaram, ${failed} falharam.`)
  process.exit(failed === 0 ? 0 : 1)
}

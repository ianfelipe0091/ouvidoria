/**
 * Teste do dashboard: gravidade, relógio do total e filtros.
 *
 * O ponto central é provar que os filtros recortam os NÚMEROS, e não apenas
 * mudam a URL — um filtro que não altera o total é pior que nenhum, porque
 * passa confiança falsa sobre o recorte.
 *
 * Uso: BASE_URL=... DEMO_PASSWORD=... node scripts/smoke-dashboard.mjs
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
const SLUG = process.env.DEMO_SLUG ?? 'demo'
const EMAIL = process.env.DEMO_EMAIL ?? `admin@${SLUG}.exemplo.br`
const SENHA = process.env.DEMO_PASSWORD
if (!SENHA) { console.error('Defina DEMO_PASSWORD.'); process.exit(1) }

const PROXY = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(BASE)
  ? undefined
  : process.env.HTTPS_PROXY ?? process.env.https_proxy

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
)

/**
 * Cliente autenticado como o usuário da empresa demo.
 *
 * Os valores esperados TÊM de vir daqui, e não do cliente administrativo: a
 * chave secreta ignora o RLS e somaria as manifestações de todos os tenants,
 * enquanto a tela mostra só as da empresa. Comparar os dois compara escopos
 * diferentes e acusa uma divergência que não existe.
 */
const comoUsuario = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
)

let passed = 0, failed = 0
const check = (nome, ok, det = '') => {
  if (ok) { passed++; console.log(`  ok   ${nome}`) }
  else { failed++; console.log(`  FALHA ${nome}${det ? ` — ${det}` : ''}`) }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  ...(PROXY ? { proxy: { server: PROXY } } : {}),
})
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
const page = await context.newPage()
const erros = []
page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
page.on('pageerror', (e) => erros.push(String(e)))

/** Número grande no centro do anel. */
async function totalDoRelogio() {
  const texto = await page.locator('.relative > svg[role=img] + div span').first().textContent()
  return Number(texto?.trim())
}

try {
  const { error: loginErro } = await comoUsuario.auth.signInWithPassword({
    email: EMAIL, password: SENHA,
  })
  if (loginErro) throw new Error(`login na API: ${loginErro.message}`)

  await page.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await page.getByLabel('E-mail', { exact: false }).fill(EMAIL)
  await page.getByLabel('Senha', { exact: true }).fill(SENHA)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/painel', { timeout: 20000 })

  console.log('\nRelógio do total')
  await page.goto(`${BASE}/painel?periodo=90`, { waitUntil: 'networkidle' })

  const { data: esperado } = await comoUsuario.rpc('dashboard_summary', { p_days: 90 })
  const totalBanco = Number(esperado.total)
  const totalTela = await totalDoRelogio()
  check('total do relógio bate com o banco', totalTela === totalBanco,
    `tela ${totalTela} vs banco ${totalBanco}`)

  const corpo = await page.textContent('body')
  check('legenda mostra as gravidades', corpo.includes('Grave') && corpo.includes('Positivo'))

  console.log('\nGravidade por tipo')
  check('denúncia aparece', corpo.includes('Denúncia'))
  check('elogio aparece', corpo.includes('Elogio'))

  // A forma é o que sustenta a cor para quem não distingue vermelho de verde.
  const formas = await page.locator('svg[aria-label="Grave"], svg[aria-label="Positivo"]').count()
  check('marcadores de gravidade têm forma própria e rótulo', formas >= 2, `${formas} marcadores`)

  const barraGrave = await page.locator('[aria-label*="Denúncia"]').first().getAttribute('aria-label')
  check('barra descreve a gravidade para leitor de tela',
    Boolean(barraGrave?.includes('Grave')), barraGrave ?? 'sem rótulo')

  console.log('\nVelocímetro de prazo (SLA)')
  const { data: gaugeEsperado } = await comoUsuario.rpc('dashboard_sla_gauge', { p_days: 90 })
  const taxa = gaugeEsperado?.taxa
  const corpoGauge = await page.textContent('body')
  check('gauge mostra a taxa de cumprimento de prazo',
    taxa == null || corpoGauge.includes(`${taxa}%`), `esperado ${taxa}%`)
  // A zona nunca depende só da cor: o rótulo por extenso acompanha.
  const zonaEsperada = taxa == null ? null : taxa < 70 ? 'Crítico' : taxa < 90 ? 'Requer atenção' : 'Saudável'
  check('gauge nomeia a zona de saúde (não só a cor)',
    zonaEsperada == null || corpoGauge.includes(zonaEsperada), zonaEsperada ?? 'sem dados')
  const gaugeAria = await page.locator('svg[aria-label*="Cumprimento de prazo"]').count()
  check('gauge tem descrição acessível', gaugeAria >= 1)

  console.log('\nFluxo recebidas × encerradas')
  const { data: fluxoEsperado } = await comoUsuario.rpc('dashboard_flow', { p_days: 90 })
  const recebidasTotal = fluxoEsperado.reduce((soma, d) => soma + Number(d.recebidas), 0)
  const encerradasTotal = fluxoEsperado.reduce((soma, d) => soma + Number(d.encerradas), 0)
  const fluxoAria = await page.locator(`svg[aria-label*="${recebidasTotal} recebidas"]`).count()
  check('gráfico de fluxo soma as recebidas do período', fluxoAria >= 1,
    `esperado ${recebidasTotal} recebidas`)
  check('legenda do fluxo traz as duas séries',
    corpoGauge.includes('Recebidas') && corpoGauge.includes('Encerradas'))
  check('fluxo descreve encerradas para leitor de tela',
    (await page.locator(`svg[aria-label*="${encerradasTotal} encerradas"]`).count()) >= 1)

  console.log('\nFiltro por estado')
  const { data: porEstado } = await comoUsuario.rpc('dashboard_breakdown', { p_dimension: 'estado', p_days: 90 })
  const uf = porEstado.find((r) => r.rotulo !== 'Não informado')
  if (!uf) throw new Error('nenhum estado com filial na base de teste')

  await page.goto(`${BASE}/painel?periodo=90&estado=${uf.rotulo}`, { waitUntil: 'networkidle' })
  const totalEstado = await totalDoRelogio()
  check(`filtro por ${uf.rotulo} recorta o total`, totalEstado === Number(uf.total),
    `tela ${totalEstado} vs esperado ${uf.total}`)
  check('o recorte aparece no cabeçalho',
    (await page.textContent('body')).includes(`estado ${uf.rotulo}`))

  console.log('\nFiltro por loja')
  const { data: branches } = await comoUsuario.from('branches')
    .select('id, name, address_state').eq('status', 'ativo').not('address_state', 'is', null)
  const loja = branches[0]
  const { data: resumoLoja } = await comoUsuario.rpc('dashboard_summary', {
    p_days: 90, p_branch_id: loja.id,
  })

  await page.goto(`${BASE}/painel?periodo=90&loja=${loja.id}`, { waitUntil: 'networkidle' })
  check(`filtro por ${loja.name} recorta o total`,
    (await totalDoRelogio()) === Number(resumoLoja.total),
    `esperado ${resumoLoja.total}`)

  console.log('\nFiltro por tipo')
  const { data: tipos } = await comoUsuario.from('occurrence_types')
    .select('id, name').eq('slug', 'denuncia').limit(1)
  const denuncia = tipos[0]
  const { data: resumoTipo } = await comoUsuario.rpc('dashboard_summary', {
    p_days: 90, p_type_id: denuncia.id,
  })

  await page.goto(`${BASE}/painel?periodo=90&tipo=${denuncia.id}`, { waitUntil: 'networkidle' })
  check('filtro por tipo recorta o total',
    (await totalDoRelogio()) === Number(resumoTipo.total),
    `esperado ${resumoTipo.total}`)
  check('com um tipo só, o relógio mostra uma gravidade',
    (await page.locator('svg[aria-label="Grave"]').count()) >= 1)

  console.log('\nCombinação e limpeza')
  await page.goto(`${BASE}/painel?periodo=90&estado=${uf.rotulo}&tipo=${denuncia.id}`,
    { waitUntil: 'networkidle' })
  const { data: resumoCombo } = await comoUsuario.rpc('dashboard_summary', {
    p_days: 90, p_state: uf.rotulo, p_type_id: denuncia.id,
  })
  check('estado e tipo combinam no mesmo recorte',
    (await totalDoRelogio()) === Number(resumoCombo.total), `esperado ${resumoCombo.total}`)

  await page.getByRole('button', { name: 'Limpar filtros' }).click()
  await page.waitForURL((u) => !u.searchParams.get('estado'), { timeout: 15000 })
  check('limpar filtros volta ao total geral', (await totalDoRelogio()) === totalBanco)

  // Trocar de estado tem de descartar a loja: ela pode ser de outro estado.
  await page.goto(`${BASE}/painel?periodo=90&estado=${uf.rotulo}&loja=${loja.id}`,
    { waitUntil: 'networkidle' })
  const outroEstado = porEstado.find((r) => r.rotulo !== 'Não informado' && r.rotulo !== uf.rotulo)
  if (outroEstado) {
    await page.getByLabel('Estado').selectOption(outroEstado.rotulo)
    await page.waitForURL((u) => u.searchParams.get('estado') === outroEstado.rotulo, { timeout: 15000 })
    check('trocar de estado descarta a loja escolhida',
      !new URL(page.url()).searchParams.get('loja'))
  }

  console.log('\nReclassificação de gravidade')
  const { data: elogio } = await comoUsuario.from('occurrence_types')
    .select('id, severity').eq('slug', 'elogio').limit(1).single()

  await admin.from('occurrence_types').update({ severity: 'grave' }).eq('id', elogio.id)
  await page.goto(`${BASE}/painel?periodo=90&nocache=${Date.now()}`, { waitUntil: 'networkidle' })
  const elogioGrave = await page.locator('li', { hasText: 'Elogio' }).first()
    .locator('svg[aria-label="Grave"]').count()
  check('mudar a gravidade do tipo muda o marcador no dashboard', elogioGrave >= 1)

  await admin.from('occurrence_types').update({ severity: elogio.severity }).eq('id', elogio.id)

  check('sem erros de console', erros.length === 0, erros.slice(0, 3).join(' | '))
} catch (error) {
  failed++
  console.error('\nErro durante o teste:', error.message.split('\n').slice(0, 4).join('\n'))
} finally {
  await browser.close()
  console.log(`\n${passed} verificações passaram, ${failed} falharam.`)
  process.exit(failed === 0 ? 0 : 1)
}

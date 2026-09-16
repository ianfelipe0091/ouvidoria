/**
 * Teste de fumaça ponta a ponta, num navegador real.
 *
 * Percorre os dois caminhos que definem o produto — o cidadão registrando e
 * acompanhando uma manifestação, e a equipe tratando-a no painel — e confere
 * que o que foi registrado de um lado aparece do outro.
 *
 * Uso: BASE_URL=http://127.0.0.1:3000 node scripts/smoke.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const SLUG = process.env.DEMO_SLUG ?? 'demo'
const EMAIL = process.env.DEMO_EMAIL ?? `admin@${SLUG}.exemplo.br`
const PASSWORD = process.env.DEMO_PASSWORD

if (!PASSWORD) {
  console.error('Defina DEMO_PASSWORD com a senha do usuário de demonstração.')
  process.exit(1)
}

let passed = 0
let failed = 0

function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ok   ${name}`) }
  else { failed++; console.log(`  FALHA ${name}${detail ? ` — ${detail}` : ''}`) }
}

// O ambiente traz um Chromium pré-instalado que pode não bater com o build
// esperado pela versão do Playwright. Apontar para ele evita baixar outro.
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

// Em ambientes com proxy de saída (CI isolada, sandbox), o navegador precisa
// ser instruído explicitamente: as variáveis HTTP(S)_PROXY não chegam sozinhas
// ao Chromium. Alvo local dispensa o proxy.
const PROXY = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(BASE)
  ? undefined
  : process.env.HTTPS_PROXY ?? process.env.https_proxy

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  ...(PROXY ? { proxy: { server: PROXY } } : {}),
})
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

const erros = []
page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
page.on('pageerror', (e) => erros.push(String(e)))

// Registra as URLs de download de anexo tentadas. A navegação em si depende de
// o navegador alcançar o domínio do Storage, o que nem todo ambiente permite —
// o que o teste precisa confirmar é que a URL assinada foi emitida.
const urlsAssinadas = []
context.on('request', (req) => {
  if (req.url().includes('/storage/v1/object/sign/')) urlsAssinadas.push(req.url())
})

try {
  console.log('\nCanal público')

  await page.goto(`${BASE}/ouvidoria/${SLUG}`, { waitUntil: 'networkidle' })
  check('canal carrega', await page.getByRole('heading', { level: 1 }).isVisible())

  await page.getByRole('link', { name: 'Registrar' }).click()
  await page.waitForURL('**/registrar')

  // Etapa 1 — identificação
  await page.getByRole('button', { name: /permanecer anônimo/i }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  // Etapa 2 — tipo
  await page.getByRole('button', { name: 'Denúncia', exact: true }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  // Etapa 3 — local
  await page.getByRole('button', { name: 'Continuar' }).click()
  // Etapa 4 — assunto
  await page.getByRole('button', { name: 'Continuar' }).click()

  // Etapa 5 — relato, com anexo
  const RELATO = 'Relato criado pelo teste de fumaça automatizado para validar o fluxo completo.'
  await page.getByRole('textbox').first().fill(RELATO)

  // PNG mínimo válido, gerado em memória: evita depender de arquivo no disco.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await page.locator('input[type=file]').setInputFiles({
    name: 'comprovante-teste.png', mimeType: 'image/png', buffer: PNG,
  })
  await page.getByRole('button', { name: 'Continuar' }).click()

  // Revisão
  const revisao = await page.textContent('body')
  check('revisão mostra o relato', revisao.includes(RELATO))
  check('revisão lista o anexo escolhido', revisao.includes('comprovante-teste.png'))
  await page.getByRole('button', { name: /Enviar manifestação/i }).click()

  await page.getByText('Manifestação registrada').waitFor({ timeout: 15000 })
  const corpo = await page.textContent('body')
  const protocolo = corpo.match(/OUV-\d{4}-\d{6}/)?.[0]
  const codigo = corpo.match(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0]

  check('protocolo gerado', Boolean(protocolo), protocolo ?? 'não encontrado')
  check('código de acompanhamento gerado', Boolean(codigo), codigo ?? 'não encontrado')
  check('avisa para guardar o código', corpo.includes('Guarde os dois agora'))

  console.log('\nConsulta pública')

  await page.goto(`${BASE}/ouvidoria/${SLUG}/consultar`, { waitUntil: 'networkidle' })
  await page.getByLabel('Protocolo').fill(protocolo)
  await page.getByLabel('Código de acompanhamento').fill('AAAA-BBBB-CCCC-DDDD')
  await page.getByRole('button', { name: 'Consultar' }).click()
  // Espera o texto do erro, não um [role=alert] qualquer: o Next mantém um
  // "route announcer" com esse papel já presente na página, e esperar por ele
  // retornaria de imediato, antes de a Server Action responder.
  await page.getByText('Protocolo ou código de acompanhamento inválido').waitFor({ timeout: 15000 })
  check('código errado é recusado', true)

  await page.getByLabel('Código de acompanhamento').fill(codigo)
  await page.getByRole('button', { name: 'Consultar' }).click()
  await page.getByText(RELATO).waitFor({ timeout: 10000 })
  check('código correto abre a manifestação', true)

  await page.getByPlaceholder('Escreva sua mensagem…').fill('Mensagem de teste do manifestante.')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await page.getByText('Mensagem de teste do manifestante.').waitFor({ timeout: 10000 })
  check('manifestante envia mensagem', true)

  console.log('\nPainel da equipe')

  await page.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' })
  await page.getByLabel('E-mail').fill(EMAIL)
  await page.getByLabel('Senha').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/painel', { timeout: 20000 })
  check('login entra no painel', page.url().includes('/painel'))

  const dash = await page.textContent('body')
  // O total passou a viver no anel de gravidade, não num cartão à parte.
  check('dashboard mostra o total e os contadores',
    dash.includes('Total do período') && dash.includes('Em atraso'))
  check('dashboard renderiza o gráfico de evolução', (await page.locator('svg').count()) > 0)
  check('dashboard mostra as barras por tipo', dash.includes('Por tipo'))

  await page.getByRole('link', { name: 'Ocorrências' }).click()
  await page.waitForURL('**/ocorrencias')
  check('lista mostra a manifestação do teste',
    (await page.textContent('body')).includes(protocolo))

  await page.getByRole('link', { name: protocolo }).click()
  await page.waitForURL(/ocorrencias\/[0-9a-f-]{36}/)
  const detalhe = await page.textContent('body')
  check('detalhe abre com o relato', detalhe.includes(RELATO))
  check('detalhe mostra a mensagem do manifestante',
    detalhe.includes('Mensagem de teste do manifestante.'))
  check('detalhe mostra o histórico', detalhe.includes('Histórico'))
  check('anexo do manifestante aparece no painel',
    detalhe.includes('comprovante-teste.png') && detalhe.includes('enviado pelo manifestante'))

  // O bucket é privado: o download só pode sair por URL assinada.
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
    page.getByRole('button', { name: 'Baixar' }).first().click(),
  ])
  await page.waitForTimeout(1500)
  check('download do anexo usa URL assinada e temporária',
    urlsAssinadas.some((u) => u.includes('token=')),
    urlsAssinadas[0]?.slice(0, 70) ?? 'nenhuma requisição ao Storage')
  if (popup) await popup.close()

  // Resposta e encerramento
  await page.getByLabel('Resposta ao manifestante').fill(
    'Analisamos o relato, tomamos as providências cabíveis e encerramos a manifestação.',
  )
  await page.getByRole('button', { name: 'Responder e encerrar' }).click()
  await page.getByText('Manifestação já encerrada').waitFor({ timeout: 15000 })
  check('resposta encerra a manifestação', true)

  console.log('\nVolta ao canal público')

  await context.clearCookies()
  await page.goto(`${BASE}/ouvidoria/${SLUG}/consultar`, { waitUntil: 'networkidle' })
  await page.getByLabel('Protocolo').fill(protocolo)
  await page.getByLabel('Código de acompanhamento').fill(codigo)
  await page.getByRole('button', { name: 'Consultar' }).click()
  await page.getByText('Resposta da ouvidoria').waitFor({ timeout: 10000 })
  const publico = await page.textContent('body')
  check('manifestante vê a resposta', publico.includes('providências cabíveis'))
  check('manifestante vê status encerrada', publico.includes('Encerrada'))

  console.log('\nResponsividade')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/ouvidoria/${SLUG}`, { waitUntil: 'networkidle' })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  check('canal não rola na horizontal em 390px', !overflow)

  check('sem erros de console', erros.length === 0, erros.slice(0, 3).join(' | '))
} catch (error) {
  failed++
  console.error('\nErro durante o teste:', error.message)
} finally {
  await browser.close()
  console.log(`\n${passed} verificações passaram, ${failed} falharam.`)
  process.exit(failed === 0 ? 0 : 1)
}

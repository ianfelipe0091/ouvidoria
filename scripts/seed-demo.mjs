/**
 * Cria uma empresa de demonstração com usuários e manifestações de exemplo.
 *
 * Serve para conferir a aplicação com dados realistas. Não é parte do produto:
 * roda sob demanda e pode ser executado de novo — cada execução cria uma
 * empresa com slug próprio.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const anon = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
})

const slug = process.env.DEMO_SLUG ?? 'demo'
const password = process.env.DEMO_PASSWORD

if (!password) {
  console.error('Defina DEMO_PASSWORD. Não há senha padrão: uma credencial')
  console.error('conhecida no repositório vira porta aberta assim que o ambiente sobe.')
  process.exit(1)
}

async function main() {
  const email = `admin@${slug}.exemplo.br`

  const { data: user, error: userError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (userError) throw new Error(`usuário: ${userError.message}`)

  const { data: companyId, error } = await admin.rpc('provision_company', {
    p_slug: slug,
    p_legal_name: 'Indústria Modelo S.A.',
    p_trade_name: 'Indústria Modelo',
    p_tax_id: String(30000000000000 + Math.floor(Math.random() * 8999999999999)),
    p_email: `contato@${slug}.exemplo.br`,
    p_admin_user_id: user.user.id,
    p_admin_name: 'Ana Ribeiro',
    p_admin_email: email,
  })
  if (error) throw new Error(`empresa: ${error.message}`)

  await admin.from('company_settings').update({
    intro_text:
      'A Indústria Modelo mantém este canal para ouvir quem trabalha, compra ou convive conosco. Toda manifestação é tratada com sigilo e recebe resposta dentro do prazo.',
    privacy_policy_text:
      'Os dados informados são usados exclusivamente para tratar a manifestação e não são compartilhados com terceiros sem obrigação legal.',
    primary_color: '#1d4ed8',
  }).eq('company_id', companyId)

  // Filiais, para exercitar o recorte por unidade.
  const { data: branches } = await admin.from('branches').insert([
    { company_id: companyId, name: 'Filial São Paulo', address_city: 'São Paulo', address_state: 'SP' },
    { company_id: companyId, name: 'Filial Recife', address_city: 'Recife', address_state: 'PE' },
  ]).select('id, name')

  await admin.from('departments').insert([
    { company_id: companyId, name: 'Recursos Humanos' },
    { company_id: companyId, name: 'Jurídico' },
    { company_id: companyId, name: 'Operações' },
  ])

  const { data: types } = await admin.from('occurrence_types').select('id, slug').eq('company_id', companyId)
  const { data: categories } = await admin.from('categories').select('id, name').eq('company_id', companyId)
  const typeBy = (s) => types.find((t) => t.slug === s)?.id
  const catBy = (n) => categories.find((c) => c.name === n)?.id

  const samples = [
    { type: 'reclamacao', cat: 'Atendimento', anon: false, name: 'Carlos Menezes',
      text: 'Aguardei mais de quarenta minutos no atendimento telefônico e a ligação caiu duas vezes sem retorno.' },
    { type: 'denuncia', cat: 'Recursos Humanos', anon: true,
      text: 'Gostaria de relatar condutas inadequadas de uma liderança da unidade, com comentários constrangedores em reuniões.' },
    { type: 'sugestao', cat: 'Operação', anon: false, name: 'Marina Alves',
      text: 'Sugiro ampliar o horário do refeitório no turno da tarde, hoje concentrado em um intervalo muito curto.' },
    { type: 'elogio', cat: 'Atendimento', anon: false, name: 'Joana Prado',
      text: 'A equipe da recepção resolveu meu problema com rapidez e muita atenção. Registro meu reconhecimento.' },
    { type: 'reclamacao', cat: 'Operação', anon: true,
      text: 'O equipamento do setor apresenta ruído excessivo há semanas e ainda não recebeu manutenção.' },
  ]

  const created = []
  for (const [index, sample] of samples.entries()) {
    const { data, error: subError } = await anon.rpc('create_manifestacao', {
      p_company_slug: slug,
      p_description: sample.text,
      p_type_id: typeBy(sample.type),
      p_category_id: catBy(sample.cat),
      p_branch_id: branches[index % branches.length].id,
      p_is_anonymous: sample.anon,
      p_reporter_name: sample.anon ? undefined : sample.name,
      p_reporter_email: sample.anon ? undefined : `${sample.name.split(' ')[0].toLowerCase()}@exemplo.br`,
    })
    if (subError) throw new Error(`manifestação: ${subError.message}`)
    created.push(data)
  }

  // Espalha as datas de abertura para o gráfico de evolução não virar uma coluna só.
  const { data: rows } = await admin.from('occurrences').select('id').eq('company_id', companyId)
  for (const [i, row] of rows.entries()) {
    const daysAgo = i * 4
    await admin.from('occurrences')
      .update({ opened_at: new Date(Date.now() - daysAgo * 86400000).toISOString() })
      .eq('id', row.id)
  }

  console.log(JSON.stringify({
    slug, email, password,
    canal: `/ouvidoria/${slug}`,
    protocolos: created.map((c) => ({ protocolo: c.protocol, codigo: c.tracking_code })),
  }, null, 2))
}

main().catch((e) => { console.error(e.message); process.exit(1) })

/**
 * Identidade da plataforma.
 *
 * Fica num arquivo só porque o nome do produto aparece em dezenas de lugares —
 * site público, título das páginas, cabeçalho do painel, rodapé do canal. Para
 * renomear o produto, mude aqui.
 *
 * Não confundir com a identidade das empresas clientes: cada uma tem a sua, em
 * `company_settings`, e é ela que aparece no canal público do cliente.
 */
export const BRAND = {
  name: 'Ouvidoria',
  /** Usado onde o nome sozinho seria ambíguo. */
  fullName: 'Ouvidoria — Plataforma SaaS',
  tagline: 'Plataforma de ouvidoria e relacionamento para empresas',
  description:
    'Receba, trate e responda manifestações num canal próprio da sua empresa. ' +
    'Reclamações, denúncias, sugestões, elogios e solicitações num só lugar, ' +
    'com prazos, indicadores e trilha de auditoria.',
  supportEmail: 'contato@exemplo.com.br',
  /**
   * WhatsApp do comercial, só dígitos com DDI e DDD (ex.: '5511999998888').
   * Enquanto for null, o botão "Falar com especialista" aparece mas não leva a
   * lugar nenhum — é aqui que se liga o atendimento.
   */
  salesWhatsapp: null as string | null,
} as const

/**
 * Link de conversa com o comercial sobre um plano negociado, com a mensagem
 * inicial já preenchida. Null enquanto o número não estiver configurado.
 */
export function salesWhatsappUrl(planName: string) {
  if (!BRAND.salesWhatsapp) return null
  const text = `Olá! Quero conhecer o plano ${planName} da Nossa Ouvidoria.`
  return `https://wa.me/${BRAND.salesWhatsapp}?text=${encodeURIComponent(text)}`
}

/**
 * Linhas de limite que abrem a lista de recursos de cada plano. Uma filial
 * conta como "filial ou empresa": o cliente pode usar a mesma estrutura para
 * as unidades de uma rede ou para empresas diferentes de um grupo.
 */
export function planLimitLines(plan: { max_branches: number | null; max_users: number | null }) {
  const b = plan.max_branches
  return [
    b === null
      ? 'Filiais ou empresas ilimitadas'
      : b === 1
        ? 'Até 1 filial ou empresa'
        : `Até ${b.toLocaleString('pt-BR')} filiais ou empresas`,
    plan.max_users === null ? 'Usuários ilimitados' : `Até ${plan.max_users} usuários`,
  ]
}

/** Rótulos dos status de assinatura. */
export const SUBSCRIPTION_LABEL = {
  trial: 'Em avaliação',
  ativa: 'Ativa',
  inadimplente: 'Pagamento pendente',
  cancelada: 'Cancelada',
} as const

export const SUBSCRIPTION_TONE = {
  trial: 'info',
  ativa: 'ok',
  inadimplente: 'warn',
  cancelada: 'danger',
} as const

export const COMPANY_STATUS_LABEL = {
  ativa: 'Ativa',
  suspensa: 'Suspensa',
  bloqueada: 'Bloqueada',
  cancelada: 'Cancelada',
} as const

export const COMPANY_STATUS_TONE = {
  ativa: 'ok',
  suspensa: 'warn',
  bloqueada: 'danger',
  cancelada: 'neutral',
} as const

const MONEY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatMoney(value: number | string) {
  return MONEY.format(Number(value))
}

/** "3 de 5" ou "3 de ilimitado" — limites nulos significam sem teto. */
export function formatLimit(used: number, limit: number | null) {
  return limit === null ? `${used} · ilimitado` : `${used} de ${limit}`
}

/** Quantos dias faltam para uma data. Negativo quando já passou. */
export function daysUntil(date: string | null) {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
}

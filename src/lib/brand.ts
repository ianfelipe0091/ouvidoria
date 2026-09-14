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
} as const

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

/**
 * Situação financeira de uma empresa cliente, em uma linha — para o painel da
 * plataforma decidir rápido quem está em dia e quem precisa de atenção.
 *
 * Deriva de duas fontes: a situação da empresa (companies.status, que o
 * administrador controla) e a assinatura (status e datas). A ordem dos testes
 * importa: um bloqueio manual prevalece sobre qualquer data.
 */

type Tone = 'neutral' | 'info' | 'warn' | 'ok' | 'danger' | 'accent'

export type Situation = {
  label: string
  tone: Tone
  detail: string | null
  /** true quando o painel do cliente está bloqueado neste momento. */
  blocked: boolean
}

/**
 * Agrupa a situação nas quatro faixas da carteira usadas nos gráficos do
 * Master, mais "fora" (cancelada / sem assinatura), que não entra na barra.
 */
export type SituationGroup = 'ok' | 'trial' | 'attention' | 'blocked' | 'out'

export function situationGroup(s: Situation): SituationGroup {
  if (s.tone === 'ok') return 'ok'
  if (s.tone === 'info') return 'trial'
  if (s.tone === 'warn') return 'attention'
  if (s.tone === 'danger') return 'blocked'
  return 'out'
}

type Input = {
  companyStatus: 'ativa' | 'suspensa' | 'bloqueada' | 'cancelada'
  subscription: {
    status: 'trial' | 'ativa' | 'inadimplente' | 'cancelada'
    trial_ends_at: string | null
    current_period_end: string | null
    grace_until: string | null
  } | null
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

export function billingSituation({ companyStatus, subscription: s }: Input): Situation {
  if (companyStatus === 'bloqueada') {
    return { label: 'Bloqueada', tone: 'danger', detail: 'bloqueio manual', blocked: true }
  }
  if (companyStatus === 'suspensa') {
    return { label: 'Suspensa', tone: 'danger', detail: 'acesso suspenso', blocked: true }
  }
  if (companyStatus === 'cancelada' || s?.status === 'cancelada') {
    return { label: 'Cancelada', tone: 'neutral', detail: null, blocked: true }
  }
  if (!s) return { label: 'Sem assinatura', tone: 'neutral', detail: null, blocked: false }

  const now = Date.now()

  if (s.status === 'trial') {
    if (s.trial_ends_at && new Date(s.trial_ends_at).getTime() < now) {
      return {
        label: 'Avaliação vencida',
        tone: 'danger',
        detail: `venceu em ${day(s.trial_ends_at)}`,
        blocked: true,
      }
    }
    return {
      label: 'Em avaliação',
      tone: 'info',
      detail: s.trial_ends_at ? `até ${day(s.trial_ends_at)}` : null,
      blocked: false,
    }
  }

  if (s.status === 'inadimplente') {
    if (s.grace_until && new Date(s.grace_until).getTime() < now) {
      return { label: 'Inadimplente', tone: 'danger', detail: 'painel bloqueado', blocked: true }
    }
    return {
      label: 'Inadimplente',
      tone: 'warn',
      detail: s.grace_until ? `tolerância até ${day(s.grace_until)}` : null,
      blocked: false,
    }
  }

  // ativa
  if (s.current_period_end && new Date(s.current_period_end).getTime() < now) {
    const n = daysSince(s.current_period_end)
    // Cobrança manual: o vencimento não bloqueia sozinho — quem decide é o
    // administrador (marcar inadimplente, suspender). Aqui só se sinaliza.
    return {
      label: 'Vencida',
      tone: 'warn',
      detail: `venceu em ${day(s.current_period_end)} (há ${n} ${n === 1 ? 'dia' : 'dias'})`,
      blocked: false,
    }
  }
  return {
    label: 'Em dia',
    tone: 'ok',
    detail: s.current_period_end ? `pago até ${day(s.current_period_end)}` : null,
    blocked: false,
  }
}

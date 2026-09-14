/**
 * Vocabulário do domínio: rótulos e cores dos enums do banco.
 *
 * Fica num só lugar para que lista, detalhe, dashboard e canal público falem
 * exatamente a mesma língua — "Em análise" não pode virar "Em Análise" numa
 * tela e "análise" em outra.
 */
import type { Database } from '@/lib/supabase/database.types'

export type OccurrenceStatus = Database['public']['Enums']['occurrence_status']
export type OccurrenceResolution = Database['public']['Enums']['occurrence_resolution']
export type AppRole = Database['public']['Enums']['app_role']
export type SlaState = Database['public']['Enums']['sla_state']
export type TaskStatus = Database['public']['Enums']['task_status']

type Tone = 'neutral' | 'info' | 'warn' | 'ok' | 'danger'

export const STATUS_LABEL: Record<OccurrenceStatus, string> = {
  recebida: 'Recebida',
  em_analise: 'Em análise',
  em_tratamento: 'Em tratamento',
  aguardando_informacoes: 'Aguardando informações',
  aguardando_resposta: 'Aguardando resposta',
  respondida: 'Respondida',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
  descartada: 'Descartada',
}

export const STATUS_TONE: Record<OccurrenceStatus, Tone> = {
  recebida: 'neutral',
  em_analise: 'info',
  em_tratamento: 'info',
  aguardando_informacoes: 'warn',
  aguardando_resposta: 'warn',
  respondida: 'ok',
  encerrada: 'ok',
  cancelada: 'neutral',
  descartada: 'neutral',
}

/** Situações que ainda demandam trabalho da equipe. */
export const OPEN_STATUSES: OccurrenceStatus[] = [
  'recebida',
  'em_analise',
  'em_tratamento',
  'aguardando_informacoes',
  'aguardando_resposta',
]

export const CLOSED_STATUSES: OccurrenceStatus[] = ['encerrada', 'cancelada', 'descartada']

/**
 * Sequência sugerida do fluxo. O sistema não impede saltos — uma ouvidoria real
 * precisa poder responder algo simples de imediato —, mas a interface propõe o
 * próximo passo a partir daqui.
 */
export const STATUS_FLOW: OccurrenceStatus[] = [
  'recebida',
  'em_analise',
  'em_tratamento',
  'aguardando_informacoes',
  'aguardando_resposta',
  'respondida',
  'encerrada',
]

export const RESOLUTION_LABEL: Record<OccurrenceResolution, string> = {
  procedente: 'Procedente',
  improcedente: 'Improcedente',
  parcialmente_procedente: 'Parcialmente procedente',
  nao_conclusivo: 'Não conclusivo',
}

export const ROLE_LABEL: Record<AppRole, string> = {
  platform_admin: 'Administrador da plataforma',
  company_admin: 'Administrador da empresa',
  ombudsman: 'Ouvidor',
  manager: 'Gestor',
  area_responsible: 'Responsável de área',
}

export const SLA_LABEL: Record<SlaState, string> = {
  no_prazo: 'No prazo',
  proximo_vencimento: 'Próximo do vencimento',
  em_atraso: 'Em atraso',
  concluida: 'Concluída',
}

export const SLA_TONE: Record<SlaState, Tone> = {
  no_prazo: 'ok',
  proximo_vencimento: 'warn',
  em_atraso: 'danger',
  concluida: 'neutral',
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

/**
 * Situação do prazo. Espelha public.occurrence_sla_state() no banco — as duas
 * precisam concordar, senão o filtro do servidor e o selo da tela divergem.
 */
export function slaState(
  status: OccurrenceStatus,
  dueAt: string,
  warningDays = 2,
): SlaState {
  if (CLOSED_STATUSES.includes(status)) return 'concluida'
  const due = new Date(dueAt).getTime()
  const now = Date.now()
  if (now > due) return 'em_atraso'
  if (now >= due - warningDays * 86_400_000) return 'proximo_vencimento'
  return 'no_prazo'
}

const DATE = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const DATE_TIME = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function formatDate(value: string | null | undefined) {
  return value ? DATE.format(new Date(value)) : '—'
}

export function formatDateTime(value: string | null | undefined) {
  return value ? DATE_TIME.format(new Date(value)) : '—'
}

/** "em 3 dias" / "há 2 dias" — mais legível que uma data no contexto de prazo. */
export function formatDeadline(dueAt: string) {
  const days = Math.round((new Date(dueAt).getTime() - Date.now()) / 86_400_000)
  if (days === 0) return 'vence hoje'
  if (days > 0) return `${days} ${days === 1 ? 'dia' : 'dias'}`
  const late = Math.abs(days)
  return `${late} ${late === 1 ? 'dia' : 'dias'} em atraso`
}

import Link from 'next/link'

import { Card, LinkButton } from '@/components/ui'
import { Logo } from '@/components/marketing'
import { BRAND } from '@/lib/brand'

export type BillingState = {
  status: 'trial' | 'ativa' | 'inadimplente' | 'cancelada'
  plan: string
  blocked: boolean
  trial_ends_at: string | null
  grace_until: string | null
  current_period_end: string | null
  company_status: 'ativa' | 'suspensa' | 'bloqueada' | 'cancelada'
}

/** Conversa com o financeiro, com a situação já descrita na mensagem. */
function financeWhatsapp(plan: string) {
  if (!BRAND.salesWhatsapp) return null
  const text = `Olá! O acesso da minha empresa à Nossa Ouvidoria (plano ${plan}) está suspenso e quero regularizar.`
  return `https://wa.me/${BRAND.salesWhatsapp}?text=${encodeURIComponent(text)}`
}

/**
 * Tela exibida quando a assinatura não está em dia.
 *
 * O administrador da empresa continua alcançando a tela de pagamento — bloquear
 * justamente quem pode resolver deixaria a conta sem saída. Os demais perfis
 * veem apenas o aviso, porque não têm o que fazer a respeito.
 */
export function BillingBlocked({
  state, canManage, onlinePayment = false,
}: {
  state: BillingState
  canManage: boolean
  /** Pagamento on-line ligado: pagar é o caminho principal, não o WhatsApp. */
  onlinePayment?: boolean
}) {
  // A situação da empresa vem antes da assinatura: um bloqueio feito pela
  // administração explica o acesso cortado melhor do que qualquer data.
  const motivo =
    state.company_status === 'bloqueada'
      ? 'O acesso desta conta foi bloqueado pela administração da plataforma.'
      : state.company_status === 'suspensa'
        ? 'O acesso foi suspenso por pendência de pagamento.'
        : state.company_status === 'cancelada' || state.status === 'cancelada'
          ? 'A assinatura foi cancelada.'
          : state.status === 'trial'
            ? 'O período de avaliação terminou.'
            : 'O pagamento está pendente e o prazo de tolerância venceu.'
  const whatsapp = financeWhatsapp(state.plan)

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center gap-2">
        <Logo />
        <span className="text-sm font-semibold">{BRAND.name}</span>
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold tracking-tight">Acesso ao painel suspenso</h1>
          <p className="text-sm leading-relaxed text-muted">
            {motivo} Para voltar a tratar manifestações, regularize a assinatura do
            plano {state.plan}.
          </p>
        </div>

        {/* Reduz o medo de perder trabalho: nada é apagado por falta de
            pagamento, e dizer isso explicitamente é parte de suspender bem. */}
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs leading-relaxed text-muted">
          Seus dados continuam guardados. Nada é apagado — assim que o pagamento for
          confirmado, tudo volta exatamente como estava.
        </p>

        {/* A cobrança é confirmada pela administração da plataforma: o caminho
            para regularizar é falar com ela. A tela de plano segue acessível ao
            administrador da empresa para consultar faturas e escolher o plano. */}
        {canManage && onlinePayment && state.company_status !== 'bloqueada' ? (
          <div className="flex flex-col gap-2">
            <LinkButton href="/painel/plano">Pagar agora (Pix, boleto ou cartão)</LinkButton>
            {whatsapp ? (
              <LinkButton href={whatsapp} target="_blank" rel="noopener noreferrer" variant="secondary">
                Falar com o financeiro
              </LinkButton>
            ) : null}
          </div>
        ) : canManage ? (
          <div className="flex flex-col gap-2">
            {whatsapp ? (
              <LinkButton href={whatsapp} target="_blank" rel="noopener noreferrer">
                Falar com o financeiro
              </LinkButton>
            ) : null}
            <LinkButton href="/painel/plano" variant="secondary">
              Ver plano e pagamentos
            </LinkButton>
          </div>
        ) : (
          <p className="text-xs text-muted">
            Procure o administrador da sua empresa para regularizar.
          </p>
        )}

        <form action="/sair" method="post">
          <button type="submit" className="text-xs text-muted underline underline-offset-4">
            Sair
          </button>
        </form>
      </Card>

      <p className="text-center text-xs text-muted">
        Precisa de ajuda?{' '}
        <Link href="/" className="underline underline-offset-4">Fale com o suporte</Link>
      </p>
    </div>
  )
}

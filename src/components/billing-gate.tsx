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
}

/**
 * Tela exibida quando a assinatura não está em dia.
 *
 * O administrador da empresa continua alcançando a tela de pagamento — bloquear
 * justamente quem pode resolver deixaria a conta sem saída. Os demais perfis
 * veem apenas o aviso, porque não têm o que fazer a respeito.
 */
export function BillingBlocked({
  state, canManage,
}: {
  state: BillingState
  canManage: boolean
}) {
  const motivo =
    state.status === 'trial'
      ? 'O período de avaliação terminou.'
      : state.status === 'inadimplente'
        ? 'Não conseguimos processar o pagamento e o prazo de tolerância venceu.'
        : 'A assinatura foi cancelada.'

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

        {canManage ? (
          <LinkButton href="/painel/plano">Regularizar assinatura</LinkButton>
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

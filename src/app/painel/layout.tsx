import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui'
import { Logo } from '@/components/marketing'
import { BRAND, SUBSCRIPTION_LABEL, SUBSCRIPTION_TONE, daysUntil } from '@/lib/brand'
import { requireProfile } from '@/lib/auth'
import { ROLE_LABEL } from '@/lib/domain'
import { PanelNav, type NavItem } from './nav'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { profile, supabase } = await requireProfile()

  const { data: company } = profile.company_id
    ? await supabase
        .from('companies')
        .select('legal_name, trade_name, onboarded_at')
        .eq('id', profile.company_id)
        .maybeSingle()
    : { data: null }

  // Empresa recém-criada cai no assistente. Só o administrador pode concluí-lo,
  // então os demais perfis entram direto — ficariam presos numa tela sem ação.
  if (company && !company.onboarded_at && profile.role === 'company_admin') {
    redirect('/onboarding')
  }

  const { data: subscription } = profile.company_id
    ? await supabase
        .from('subscriptions')
        .select('status, trial_ends_at, plans(name)')
        .eq('company_id', profile.company_id)
        .maybeSingle()
    : { data: null }

  const isAdmin = ['platform_admin', 'company_admin'].includes(profile.role)
  const trialLeft = subscription?.status === 'trial' ? daysUntil(subscription.trial_ends_at) : null

  const items: NavItem[] = [
    { href: '/painel', label: 'Dashboard' },
    { href: '/painel/ocorrencias', label: 'Ocorrências' },
    // Cadastros são do administrador da empresa; ouvidor e gestor não os veem.
    ...(isAdmin
      ? [
          { href: '/painel/filiais', label: 'Filiais' },
          { href: '/painel/usuarios', label: 'Usuários' },
          { href: '/painel/categorias', label: 'Categorias' },
          { href: '/painel/configuracoes', label: 'Configurações' },
          { href: '/painel/plano', label: 'Plano' },
        ]
      : []),
    ...(profile.role === 'platform_admin' ? [{ href: '/master', label: 'Plataforma' }] : []),
  ]

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          {/* A marca da plataforma fica ao lado do nome da empresa: deixa claro
              que este é o ambiente de um cliente dentro de um produto, e não um
              sistema feito só para ele. */}
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {company?.trade_name ?? company?.legal_name ?? BRAND.name}
              </p>
              <p className="truncate text-xs text-muted">
                {profile.full_name} · {ROLE_LABEL[profile.role]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {subscription ? (
              <Badge tone={SUBSCRIPTION_TONE[subscription.status]}>
                {subscription.plans?.name}
                {subscription.status !== 'ativa' ? ` · ${SUBSCRIPTION_LABEL[subscription.status]}` : ''}
              </Badge>
            ) : null}
            <form action="/sair" method="post">
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-xs text-muted transition hover:bg-surface-muted"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        {trialLeft !== null ? (
          <div className="border-t border-border bg-info-soft px-6 py-2">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-info">
              <span>
                {trialLeft > 0
                  ? `Avaliação gratuita — ${trialLeft} ${trialLeft === 1 ? 'dia restante' : 'dias restantes'}.`
                  : 'Seu período de avaliação terminou.'}
              </span>
              {isAdmin ? (
                <a href="/painel/plano" className="font-medium underline underline-offset-4">
                  Ver planos
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6 md:flex-row">
        <aside className="md:w-48 md:shrink-0">
          <PanelNav items={items} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

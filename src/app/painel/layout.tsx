import { requireProfile } from '@/lib/auth'
import { ROLE_LABEL } from '@/lib/domain'
import { PanelNav, type NavItem } from './nav'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { profile, supabase } = await requireProfile()

  const { data: company } = profile.company_id
    ? await supabase
        .from('companies')
        .select('legal_name, trade_name')
        .eq('id', profile.company_id)
        .maybeSingle()
    : { data: null }

  const isAdmin = ['platform_admin', 'company_admin'].includes(profile.role)

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
        ]
      : []),
    ...(profile.role === 'platform_admin' ? [{ href: '/master', label: 'Plataforma' }] : []),
  ]

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {company?.trade_name ?? company?.legal_name ?? 'Plataforma'}
            </p>
            <p className="truncate text-xs text-muted">
              {profile.full_name} · {ROLE_LABEL[profile.role]}
            </p>
          </div>
          <form action="/sair" method="post">
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-xs text-muted transition hover:bg-surface-muted"
            >
              Sair
            </button>
          </form>
        </div>
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

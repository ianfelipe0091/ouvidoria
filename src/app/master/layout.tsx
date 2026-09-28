import { Badge } from '@/components/ui'
import { Logo } from '@/components/marketing'
import { BRAND } from '@/lib/brand'
import { requirePlatformAdmin } from '@/lib/auth'
import { MasterNav } from './nav'

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePlatformAdmin()

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                {BRAND.name}
                <Badge tone="accent">Plataforma</Badge>
              </p>
              <p className="text-xs text-muted">{profile.full_name}</p>
            </div>
          </div>
          <form action="/sair" method="post">
            <button type="submit" className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-surface-muted">
              Sair
            </button>
          </form>
        </div>
        <div className="mx-auto w-full max-w-6xl px-6">
          <MasterNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
    </div>
  )
}

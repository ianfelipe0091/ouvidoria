import Link from 'next/link'

import { requirePlatformAdmin } from '@/lib/auth'

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePlatformAdmin()

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div>
            <p className="text-sm font-semibold">Painel da plataforma</p>
            <p className="text-xs text-muted">{profile.full_name}</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/painel" className="text-muted underline underline-offset-4">
              Voltar ao painel
            </Link>
            <form action="/sair" method="post">
              <button type="submit" className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-muted">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
    </div>
  )
}

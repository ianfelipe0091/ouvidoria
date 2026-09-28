'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/components/ui'

const TABS = [
  { href: '/master', label: 'Visão geral', match: (p: string) => p === '/master' },
  { href: '/master/empresas', label: 'Empresas', match: (p: string) => p.startsWith('/master/empresas') },
]

/** Abas do painel Master. A aba de empresas continua acesa dentro do detalhe. */
export function MasterNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Painel da plataforma" className="-mb-px flex gap-1">
      {TABS.map((tab) => {
        const active = tab.match(pathname)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'border-b-2 px-3 py-2.5 text-sm transition-colors',
              active
                ? 'border-accent font-medium text-foreground'
                : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

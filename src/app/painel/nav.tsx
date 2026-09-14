'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/components/ui'

export type NavItem = { href: string; label: string }

export function PanelNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Seções do painel" className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((item) => {
        // "/painel" só está ativo na própria raiz; as demais também nas subrotas.
        const active =
          item.href === '/painel' ? pathname === item.href : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-2 text-sm whitespace-nowrap transition',
              active ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-muted',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

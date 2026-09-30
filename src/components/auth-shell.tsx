import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Icon } from '@/components/landing/icons'
import { BRAND } from '@/lib/brand'
import logoWordmark from '@/../public/landing/logo.png'

const POINTS = [
  'Canal próprio da sua empresa, no ar em minutos',
  'Prazos, responsáveis e histórico de cada manifestação',
  'Sigilo, anonimato e trilha de auditoria de ponta a ponta',
]

/**
 * Moldura das telas de acesso (entrar, recuperar e redefinir senha).
 *
 * No desktop, a marca ocupa a metade esquerda — é a primeira tela que o
 * cliente vê todo dia, e ela precisa parecer o mesmo produto da landing. No
 * celular, só o formulário, com o logo no topo.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-full flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-[oklch(0.53_0.22_263)] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Brilho suave de fundo, só decorativo. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-[28rem] rounded-full bg-white/10 blur-3xl"
        />
        <Link href="/" className="relative w-fit rounded-xl bg-white px-4 py-2.5">
          <Image src={logoWordmark} alt={BRAND.name} priority className="h-7 w-auto" />
        </Link>

        <div className="relative flex flex-col gap-6">
          <h2 className="max-w-md text-3xl leading-tight font-semibold tracking-tight">
            A ouvidoria da sua empresa, do registro à resposta.
          </h2>
          <ul className="flex flex-col gap-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-white/90">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/20">
                  <Icon name="check" size={12} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/70">
          <Icon name="lock-keyhole" size={14} />
          Conexão segura · dados hospedados no Brasil
        </p>
      </aside>

      <div className="flex flex-col">
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
          <Link href="/" className="w-fit lg:hidden" aria-label={BRAND.name}>
            <Image src={logoWordmark} alt={BRAND.name} priority className="h-8 w-auto" />
          </Link>
          {children}
        </main>
        <footer className="px-6 py-5 text-center text-xs text-muted">
          © {new Date().getFullYear()} {BRAND.name}
        </footer>
      </div>
    </div>
  )
}

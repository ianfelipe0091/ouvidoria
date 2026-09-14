import Link from 'next/link'

import { LinkButton } from '@/components/ui'
import { currentProfile } from '@/lib/auth'

export default async function Home() {
  const profile = await currentProfile()

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Ouvidoria</h1>
        <p className="text-sm leading-relaxed text-muted">
          Plataforma de ouvidoria e relacionamento multiempresa. Cada cliente tem
          seu próprio canal público, com identidade visual e configuração
          próprias, e um painel para triagem, tratamento e indicadores.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        {profile ? (
          <LinkButton href="/painel">Ir para o painel</LinkButton>
        ) : (
          <LinkButton href="/entrar">Acessar o painel</LinkButton>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted">
        O canal público de cada empresa fica em{' '}
        <code className="rounded bg-surface-muted px-1 py-0.5 font-mono">/ouvidoria/&lt;empresa&gt;</code>.
        O estado da conexão com o banco está em{' '}
        <Link href="/api/health" className="underline underline-offset-4">/api/health</Link>.
      </p>
    </main>
  )
}

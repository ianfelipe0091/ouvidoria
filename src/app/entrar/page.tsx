import type { Metadata } from 'next'

import Link from 'next/link'

import { Card } from '@/components/ui'
import { Logo, SiteFooter } from '@/components/marketing'
import { BRAND } from '@/lib/brand'
import { SignInForm } from './form'

export const metadata: Metadata = { title: `Entrar | ${BRAND.name}` }

const MESSAGES: Record<string, string> = {
  'sem-acesso': 'Sua conta não tem acesso a nenhuma empresa. Procure o administrador.',
  'sem-permissao': 'Você não tem permissão para acessar aquela área.',
}

export default async function SignInPage(props: PageProps<'/entrar'>) {
  const params = await props.searchParams
  const erro = typeof params.erro === 'string' ? MESSAGES[params.erro] : null

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
        <Link href="/" className="flex items-center gap-2 self-start">
          <Logo />
          <span className="text-sm font-semibold">{BRAND.name}</span>
        </Link>

        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
          <p className="text-sm text-muted">Acesso à área de gestão da sua empresa.</p>
        </header>

      {erro ? (
        <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          {erro}
        </p>
      ) : null}

        <Card className="p-5">
          <SignInForm />
        </Card>

        <p className="text-center text-xs text-muted">
          Ainda não tem conta?{' '}
          <Link href="/criar-conta" className="font-medium underline underline-offset-4">
            Criar conta da sua empresa
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}

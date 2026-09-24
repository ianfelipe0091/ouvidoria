import type { Metadata } from 'next'
import Link from 'next/link'

import { Card } from '@/components/ui'
import { Logo, SiteFooter } from '@/components/marketing'
import { BRAND } from '@/lib/brand'
import { ResetRequestForm } from './form'

export const metadata: Metadata = { title: `Recuperar senha | ${BRAND.name}` }

export default async function ForgotPasswordPage(props: PageProps<'/esqueci-senha'>) {
  const params = await props.searchParams
  const linkError = params.erro === 'link'

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
        <Link href="/" className="flex items-center gap-2 self-start">
          <Logo />
          <span className="text-sm font-semibold">{BRAND.name}</span>
        </Link>

        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Recuperar senha</h1>
          <p className="text-sm text-muted">
            Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
          </p>
        </header>

        {linkError ? (
          <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
            O link é inválido ou expirou. Peça um novo abaixo.
          </p>
        ) : null}

        <Card className="p-5">
          <ResetRequestForm />
        </Card>

        <p className="text-center text-xs text-muted">
          Lembrou a senha?{' '}
          <Link href="/entrar" className="font-medium underline underline-offset-4">
            Voltar para o login
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}

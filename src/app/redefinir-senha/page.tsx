import type { Metadata } from 'next'
import Link from 'next/link'

import { Card } from '@/components/ui'
import { Logo, SiteFooter } from '@/components/marketing'
import { BRAND } from '@/lib/brand'
import { createClient } from '@/lib/supabase/server'
import { NewPasswordForm } from './form'

export const metadata: Metadata = { title: `Nova senha | ${BRAND.name}` }

export default async function ResetPasswordPage() {
  // A sessão de recuperação é aberta por /auth/confirmar ao clicar no link do
  // e-mail. Sem ela, não há o que redefinir: mandamos pedir um link novo.
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const hasSession = Boolean(auth?.user)

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
        <Link href="/" className="flex items-center gap-2 self-start">
          <Logo />
          <span className="text-sm font-semibold">{BRAND.name}</span>
        </Link>

        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Definir nova senha</h1>
          <p className="text-sm text-muted">Escolha uma senha para voltar a acessar sua conta.</p>
        </header>

        <Card className="p-5">
          {hasSession ? (
            <NewPasswordForm />
          ) : (
            <div className="flex flex-col gap-3 text-sm text-muted">
              <p>Este link é inválido ou já expirou.</p>
              <Link
                href="/esqueci-senha"
                className="font-medium text-accent underline underline-offset-4"
              >
                Pedir um novo link de recuperação
              </Link>
            </div>
          )}
        </Card>
      </main>

      <SiteFooter />
    </div>
  )
}

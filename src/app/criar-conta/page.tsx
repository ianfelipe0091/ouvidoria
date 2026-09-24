import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui'
import { SiteFooter, SiteHeader } from '@/components/marketing'
import { BRAND, formatMoney, planLimitLines } from '@/lib/brand'
import { currentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { SignUpForm } from './form'

export const metadata: Metadata = { title: `Criar conta | ${BRAND.name}` }

export default async function SignUpPage(props: PageProps<'/criar-conta'>) {
  // Quem já está logado não tem o que fazer aqui.
  if (await currentProfile()) redirect('/painel')

  const params = await props.searchParams
  const requested = typeof params.plano === 'string' ? params.plano : 'basic'

  const supabase = await createClient()
  const { data: plans } = await supabase
    .from('plans')
    .select('slug, name, monthly_price, trial_days, max_branches, max_users')
    .eq('is_active', true)
    .eq('is_public', true)
    // Plano negociado não se contrata pelo cadastro; ?plano= com ele cai no
    // primeiro plano de tabela (o banco recusaria de qualquer forma).
    .eq('self_service', true)
    .order('sort_order')

  const plan = plans?.find((p) => p.slug === requested) ?? plans?.[0]

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12 md:flex-row md:gap-10">
        <div className="flex flex-col gap-4 md:w-64 md:shrink-0">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Criar conta</h1>
            <p className="mt-1 text-sm text-muted">
              Seu ambiente é criado na hora, já com a matriz e a classificação padrão.
            </p>
          </div>

          {plan ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Plano {plan.name}</span>
                <Badge tone="accent">{plan.trial_days} dias grátis</Badge>
              </div>
              <p className="text-xs text-muted">
                {formatMoney(plan.monthly_price)}/mês após a avaliação ·{' '}
                {planLimitLines(plan)[0].toLowerCase()}
              </p>
              <Link href="/#planos" className="text-xs underline underline-offset-4">
                Ver todos os planos
              </Link>
            </div>
          ) : null}

          <p className="text-xs text-muted">
            Já tem conta?{' '}
            <Link href="/entrar" className="underline underline-offset-4">Entrar</Link>
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <SignUpForm planSlug={plan?.slug ?? 'basic'} />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

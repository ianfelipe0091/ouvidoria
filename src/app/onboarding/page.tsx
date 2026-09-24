import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { Logo } from '@/components/marketing'
import { cn } from '@/components/ui'
import { BRAND } from '@/lib/brand'
import { requireCompanyAdmin } from '@/lib/auth'
import { BranchStep, DoneStep, IdentityStep } from './client'

export const metadata: Metadata = { title: `Configuração inicial | ${BRAND.name}` }

const STEPS = [
  { id: 'identidade', label: 'Identidade' },
  { id: 'unidade', label: 'Primeira unidade' },
  { id: 'pronto', label: 'Pronto' },
] as const

export default async function OnboardingPage(props: PageProps<'/onboarding'>) {
  const params = await props.searchParams
  const { profile, supabase } = await requireCompanyAdmin()

  const [company, settings, branch] = await Promise.all([
    supabase
      .from('companies')
      .select('slug, legal_name, trade_name, onboarded_at')
      .eq('id', profile.company_id!)
      .maybeSingle(),
    supabase.from('company_settings').select('*').eq('company_id', profile.company_id!).maybeSingle(),
    supabase
      .from('branches')
      .select('name, address_city, address_state, phone, email')
      .eq('company_id', profile.company_id!)
      .eq('is_headquarters', true)
      .maybeSingle(),
  ])

  if (!company.data) redirect('/painel')
  // Já configurado: reabrir o assistente pelo endereço não deve prender ninguém.
  if (company.data.onboarded_at) redirect('/painel')

  const step = (typeof params.etapa === 'string' ? params.etapa : 'identidade') as
    (typeof STEPS)[number]['id']
  const index = Math.max(0, STEPS.findIndex((s) => s.id === step))

  const host = (await headers()).get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
  const channelUrl = `${protocol}://${host}/${company.data.slug}`

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-semibold">{BRAND.name}</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Vamos configurar a ouvidoria da {company.data.trade_name ?? company.data.legal_name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Três passos rápidos. Tudo pode ser alterado depois em Configurações.
          </p>
        </div>
      </header>

      <ol className="flex flex-wrap gap-4" aria-label="Etapas da configuração">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={cn(
                'grid size-6 place-items-center rounded-full text-xs font-medium',
                i < index
                  ? 'bg-ok-soft text-ok'
                  : i === index
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-surface-muted text-muted',
              )}
              aria-current={i === index ? 'step' : undefined}
            >
              {i < index ? '✓' : i + 1}
            </span>
            <span className={cn('text-sm', i === index ? 'font-medium' : 'text-muted')}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      {step === 'identidade' ? (
        <IdentityStep
          defaults={{
            channel_name:
              settings.data?.channel_name ?? company.data.trade_name ?? company.data.legal_name,
            logo_url: settings.data?.logo_url ?? '',
            primary_color: settings.data?.primary_color ?? '#1f2937',
            secondary_color: settings.data?.secondary_color ?? '#4b5563',
            intro_text: settings.data?.intro_text ?? '',
          }}
        />
      ) : null}

      {step === 'unidade' ? (
        <BranchStep
          defaults={{
            name: branch.data?.name ?? 'Matriz',
            address_city: branch.data?.address_city ?? '',
            address_state: branch.data?.address_state ?? '',
            phone: branch.data?.phone ?? '',
            email: branch.data?.email ?? '',
          }}
        />
      ) : null}

      {step === 'pronto' ? <DoneStep channelUrl={channelUrl} /> : null}
    </div>
  )
}

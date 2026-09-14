import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/ui'
import { requireCompanyAdmin } from '@/lib/auth'
import { SettingsForm } from './client'

export default async function SettingsPage() {
  const { profile, supabase } = await requireCompanyAdmin()
  if (!profile.company_id) notFound()

  const [company, settings] = await Promise.all([
    supabase
      .from('companies')
      .select('trade_name, email, phone, website, slug')
      .eq('id', profile.company_id)
      .maybeSingle(),
    supabase.from('company_settings').select('*').eq('company_id', profile.company_id).maybeSingle(),
  ])

  if (!company.data || !settings.data) notFound()

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Configurações" description="Dados da empresa, identidade do canal e prazos." />
      <SettingsForm company={company.data} settings={settings.data} />
    </div>
  )
}

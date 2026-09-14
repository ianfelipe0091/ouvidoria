'use client'

import { useState, useTransition } from 'react'

import { Button, FormError, Select } from '@/components/ui'
import type { Database } from '@/lib/supabase/database.types'
import { setCompanyPlan, setCompanyStatus } from './actions'

type CompanyStatus = Database['public']['Enums']['company_status']

export function CompanyActions({
  companyId, status, planSlug, plans,
}: {
  companyId: string
  status: CompanyStatus
  planSlug: string
  plans: Array<{ slug: string; name: string }>
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => setError((await fn()).error ?? null))

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Select
          value={planSlug}
          disabled={pending}
          aria-label="Plano da empresa"
          className="w-auto! py-1 text-xs"
          onChange={(e) => run(() => setCompanyPlan(companyId, e.target.value))}
        >
          {plans.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </Select>

        {status === 'ativa' ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => setCompanyStatus(companyId, 'suspensa', 'inadimplente'))}
          >
            Suspender
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => setCompanyStatus(companyId, 'ativa', 'ativa'))}
          >
            Reativar
          </Button>
        )}
      </div>
      {error ? <FormError message={error} /> : null}
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'

import { Select } from '@/components/ui'

export function PeriodPicker({ value }: { value: string }) {
  const router = useRouter()

  return (
    <Select
      value={value}
      aria-label="Período do dashboard"
      className="w-auto!"
      onChange={(e) => router.push(`/painel?periodo=${e.target.value}`)}
    >
      <option value="7">Últimos 7 dias</option>
      <option value="30">Últimos 30 dias</option>
      <option value="90">Últimos 90 dias</option>
      <option value="365">Últimos 12 meses</option>
    </Select>
  )
}

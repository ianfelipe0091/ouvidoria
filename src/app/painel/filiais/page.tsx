import { Card, EmptyState, PageHeader } from '@/components/ui'
import { requireCompanyAdmin } from '@/lib/auth'
import { BranchToggle, NewBranchForm, StatusBadge } from './client'

export default async function BranchesPage() {
  const { supabase } = await requireCompanyAdmin()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, trade_name, internal_code, address_city, address_state, status, is_headquarters')
    .order('is_headquarters', { ascending: false })
    .order('name')

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Filiais"
        description="Unidades da empresa. Usuários são vinculados a elas para limitar o que enxergam."
      />
      <NewBranchForm />

      <Card className="overflow-hidden">
        {!branches?.length ? (
          <EmptyState title="Nenhuma filial cadastrada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Filial</th>
                  <th scope="col" className="px-4 py-3 font-medium">Código</th>
                  <th scope="col" className="px-4 py-3 font-medium">Cidade</th>
                  <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      {branch.name}
                      {branch.is_headquarters ? (
                        <span className="ml-2 text-[11px] text-muted">matriz</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{branch.internal_code ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {branch.address_city
                        ? `${branch.address_city}${branch.address_state ? `/${branch.address_state}` : ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge active={branch.status === 'ativo'} /></td>
                    <td className="px-4 py-3 text-right">
                      <BranchToggle id={branch.id} active={branch.status === 'ativo'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

import { StatTile } from '@/components/charts'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { requirePlatformAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/domain'

const STATUS_TONE = {
  ativa: 'ok',
  suspensa: 'warn',
  bloqueada: 'danger',
  cancelada: 'neutral',
} as const

export default async function MasterPage() {
  const { supabase } = await requirePlatformAdmin()

  /* O platform_admin atravessa o RLS por policy, então estas contagens somam
     todos os tenants — é o único perfil para o qual isso é verdade. */
  const [companies, branches, users, occurrences, openOccurrences, lateOccurrences] =
    await Promise.all([
      supabase.from('companies').select('id, slug, legal_name, trade_name, tax_id, status, created_at'),
      supabase.from('branches').select('company_id'),
      // Somente perfis de clientes: o administrador da plataforma não pertence
      // a empresa alguma e não deve entrar nessa contagem.
      supabase.from('profiles').select('company_id').not('company_id', 'is', null),
      supabase.from('occurrences').select('company_id'),
      supabase
        .from('occurrences')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '("encerrada","cancelada","descartada")'),
      supabase
        .from('occurrences')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '("encerrada","cancelada","descartada")')
        .lt('due_at', new Date().toISOString()),
    ])

  const list = companies.data ?? []
  const countBy = (rows: Array<{ company_id: string | null }> | null, id: string) =>
    (rows ?? []).filter((r) => r.company_id === id).length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Plataforma"
        description="Visão consolidada de todas as empresas clientes."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Empresas cadastradas" value={list.length} />
        <StatTile label="Empresas ativas" value={list.filter((c) => c.status === 'ativa').length} />
        <StatTile label="Filiais" value={(branches.data ?? []).length} />
        <StatTile label="Usuários" value={(users.data ?? []).length} />
        <StatTile label="Ocorrências em aberto" value={openOccurrences.count ?? 0} />
        <StatTile
          label="Ocorrências em atraso"
          value={lateOccurrences.count ?? 0}
          tone={lateOccurrences.count ? 'danger' : undefined}
        />
      </div>

      <Card className="overflow-hidden">
        {!list.length ? (
          <EmptyState
            title="Nenhuma empresa cadastrada"
            description="Use a função provision_company() para criar a primeira."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Empresa</th>
                  <th scope="col" className="px-4 py-3 font-medium">CNPJ</th>
                  <th scope="col" className="px-4 py-3 font-medium">Canal</th>
                  <th scope="col" className="px-4 py-3 font-medium">Filiais</th>
                  <th scope="col" className="px-4 py-3 font-medium">Usuários</th>
                  <th scope="col" className="px-4 py-3 font-medium">Ocorrências</th>
                  <th scope="col" className="px-4 py-3 font-medium">Desde</th>
                  <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {list.map((company) => (
                  <tr key={company.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{company.trade_name ?? company.legal_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{company.tax_id}</td>
                    <td className="px-4 py-3 text-xs">
                      <a
                        href={`/ouvidoria/${company.slug}`}
                        className="underline underline-offset-4"
                      >
                        /{company.slug}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">{countBy(branches.data, company.id)}</td>
                    <td className="px-4 py-3 text-xs tabular-nums">{countBy(users.data, company.id)}</td>
                    <td className="px-4 py-3 text-xs tabular-nums">{countBy(occurrences.data, company.id)}</td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(company.created_at)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[company.status]}>{company.status}</Badge>
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

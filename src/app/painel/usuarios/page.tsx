import { Card, EmptyState, PageHeader } from '@/components/ui'
import { requireCompanyAdmin } from '@/lib/auth'
import { ROLE_LABEL } from '@/lib/domain'
import { NewUserForm, UserBadge, UserToggle } from './client'

export default async function UsersPage() {
  const { supabase } = await requireCompanyAdmin()

  const [users, departments] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, role, job_title, status, departments(name)')
      .order('full_name'),
    supabase.from('departments').select('id, name').eq('status', 'ativo').order('name'),
  ])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Usuários"
        description="Quem acessa o painel e com qual alcance."
      />
      <NewUserForm departments={departments.data ?? []} />

      <Card className="overflow-hidden">
        {!users.data?.length ? (
          <EmptyState title="Nenhum usuário cadastrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Nome</th>
                  <th scope="col" className="px-4 py-3 font-medium">E-mail</th>
                  <th scope="col" className="px-4 py-3 font-medium">Perfil</th>
                  <th scope="col" className="px-4 py-3 font-medium">Departamento</th>
                  <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.data.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      {user.full_name}
                      {user.job_title ? (
                        <span className="block text-[11px] text-muted">{user.job_title}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{user.email}</td>
                    <td className="px-4 py-3 text-xs">{ROLE_LABEL[user.role]}</td>
                    <td className="px-4 py-3 text-xs">{user.departments?.name ?? '—'}</td>
                    <td className="px-4 py-3"><UserBadge active={user.status === 'ativo'} /></td>
                    <td className="px-4 py-3 text-right">
                      <UserToggle id={user.id} active={user.status === 'ativo'} />
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

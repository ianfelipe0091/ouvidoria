'use client'

import { useActionState, useState, useTransition } from 'react'

import { Badge, Button, Card, CardHeader, EmptyState, Field, FormError, Input, Select, cn } from '@/components/ui'
import { ROLE_LABEL } from '@/lib/domain'
import type { Database } from '@/lib/supabase/database.types'
import { adminCreateUser, adminResetUserPassword, adminUpdateUser, type Result } from '../../actions'

type AppRole = Database['public']['Enums']['app_role']

const ROLES = ['company_admin', 'ombudsman', 'manager', 'area_responsible'] as const

export type CompanyUser = {
  id: string
  full_name: string
  email: string
  phone: string | null
  job_title: string | null
  department_id: string | null
  role: AppRole
  status: 'ativo' | 'inativo'
  created_label: string
  last_sign_in_label: string | null
}

type Department = { id: string; name: string }

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')

/**
 * Usuários da empresa, editáveis pela administração da plataforma.
 *
 * Um usuário por vez fica aberto para edição: a lista continua legível e não
 * há como salvar o formulário de um achando que é o de outro.
 */
export function CompanyUsers({
  companyId, users, departments, limitLabel,
}: {
  companyId: string
  users: CompanyUser[]
  departments: Department[]
  limitLabel: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <Card>
      <CardHeader
        title="Usuários"
        description={`Quem acessa o painel desta empresa · ${limitLabel}`}
        action={
          creating ? null : (
            <Button size="sm" variant="secondary" onClick={() => { setCreating(true); setOpenId(null) }}>
              + Novo usuário
            </Button>
          )
        }
      />

      {creating ? (
        <div className="border-b border-border bg-surface-muted/60 px-5 py-4">
          <NewUser companyId={companyId} departments={departments} onClose={() => setCreating(false)} />
        </div>
      ) : null}

      {!users.length ? (
        <EmptyState title="Nenhum usuário" description="Crie o primeiro acesso para esta empresa." />
      ) : (
        <ul className="divide-y divide-border">
          {users.map((u) => {
            const open = openId === u.id
            const active = u.status === 'ativo'
            return (
              <li key={u.id} className={cn(open && 'bg-surface-muted/60')}>
                <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold',
                      active ? 'bg-accent-soft text-accent' : 'bg-surface-muted text-muted',
                    )}
                  >
                    {initials(u.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('flex flex-wrap items-center gap-2 text-sm font-medium', !active && 'text-muted')}>
                      {u.full_name}
                      <Badge tone={u.role === 'company_admin' ? 'accent' : 'neutral'}>{ROLE_LABEL[u.role]}</Badge>
                      {!active ? <Badge tone="danger">Inativo</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {u.email}
                      {u.job_title ? ` · ${u.job_title}` : ''}
                    </p>
                    <p className="text-[11px] text-muted">
                      {u.last_sign_in_label ? `Último acesso ${u.last_sign_in_label}` : 'Nunca acessou'} · desde{' '}
                      {u.created_label}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={open ? 'ghost' : 'secondary'}
                    aria-expanded={open}
                    onClick={() => { setOpenId(open ? null : u.id); setCreating(false) }}
                  >
                    {open ? 'Fechar' : 'Editar'}
                  </Button>
                </div>
                {open ? (
                  <div className="flex flex-col gap-4 px-5 pb-5">
                    <EditUser companyId={companyId} user={u} departments={departments} />
                    <ResetPassword companyId={companyId} user={u} />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

// ----------------------------------------------------------- formulário --

function UserFields({ user, departments }: { user?: CompanyUser; departments: Department[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nome completo" required>
        <Input name="full_name" required defaultValue={user?.full_name} />
      </Field>
      <Field label="E-mail (login)" required>
        <Input name="email" type="email" required defaultValue={user?.email} />
      </Field>
      <Field label="Perfil de acesso" required>
        <Select name="role" required defaultValue={user?.role ?? 'ombudsman'}>
          {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
        </Select>
      </Field>
      <Field label="Departamento">
        <Select name="department_id" defaultValue={user?.department_id ?? ''}>
          <option value="">Sem departamento</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </Field>
      <Field label="Cargo">
        <Input name="job_title" defaultValue={user?.job_title ?? ''} />
      </Field>
      <Field label="Telefone">
        <Input name="phone" defaultValue={user?.phone ?? ''} />
      </Field>
    </div>
  )
}

function EditUser({ companyId, user, departments }: { companyId: string; user: CompanyUser; departments: Department[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(
    adminUpdateUser.bind(null, companyId, user.id), {},
  )

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <UserFields user={user} departments={departments} />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-medium">Situação</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="status" value="ativo" defaultChecked={user.status === 'ativo'} />
          Ativo — pode entrar no painel
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="status" value="inativo" defaultChecked={user.status !== 'ativo'} />
          Inativo — o acesso é bloqueado, o histórico dele fica
        </label>
      </fieldset>

      <p className="text-[11px] text-muted">
        Mudar o e-mail muda o login na hora: o usuário passa a entrar com o endereço novo e a mesma senha.
      </p>
      <FormError message={state.error} />
      {state.message ? (
        <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">{state.message}</p>
      ) : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  )
}

function NewUser({ companyId, departments, onClose }: { companyId: string; departments: Department[]; onClose: () => void }) {
  const [state, action, pending] = useActionState<Result, FormData>(
    adminCreateUser.bind(null, companyId), {},
  )

  if (state.password) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{state.message}</p>
        <PasswordReveal password={state.password} />
        <div>
          <Button size="sm" variant="secondary" onClick={onClose}>Concluir</Button>
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm font-semibold">Novo usuário</p>
      <UserFields departments={departments} />
      <p className="text-[11px] text-muted">
        Uma senha inicial é gerada e mostrada uma única vez, para você entregar ao usuário.
      </p>
      <FormError message={state.error} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Criando…' : 'Criar usuário'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------- senha --

function ResetPassword({ companyId, user }: { companyId: string; user: CompanyUser }) {
  const [result, setResult] = useState<Result>({})
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-semibold">Senha</p>
        <p className="text-xs text-muted">
          Gera uma senha nova para {user.full_name.split(' ')[0]}. A atual deixa de funcionar na hora.
        </p>
      </div>
      {result.password ? (
        <PasswordReveal password={result.password} />
      ) : confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setResult(await adminResetUserPassword(companyId, user.id))
                setConfirming(false)
              })
            }
          >
            {pending ? 'Gerando…' : 'Confirmar nova senha'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancelar</Button>
        </div>
      ) : (
        <div>
          <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
            Gerar nova senha
          </Button>
        </div>
      )}
      <FormError message={result.error} />
    </div>
  )
}

function PasswordReveal({ password }: { password: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
        Anote ou copie agora: esta senha não será mostrada de novo.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-surface-muted px-3 py-2 font-mono text-base tracking-wider select-all">
          {password}
        </code>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password)
              setCopied(true)
            } catch {
              setCopied(false)
            }
          }}
        >
          {copied ? 'Copiada ✓' : 'Copiar'}
        </Button>
      </div>
    </div>
  )
}

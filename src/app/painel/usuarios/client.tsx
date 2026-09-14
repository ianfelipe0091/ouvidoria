'use client'

import { useActionState, useState, useTransition } from 'react'

import { Badge, Button, Card, CardHeader, Field, FormError, Input, Select } from '@/components/ui'
import { ROLE_LABEL } from '@/lib/domain'
import { createUser, toggleUser, type Result } from './actions'

const ASSIGNABLE = ['company_admin', 'ombudsman', 'manager', 'area_responsible'] as const

export function NewUserForm({ departments }: { departments: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState<Result, FormData>(createUser, {})
  const [open, setOpen] = useState(false)

  if (!open && !state.password) {
    return <Button size="sm" onClick={() => setOpen(true)}>Novo usuário</Button>
  }

  return (
    <Card className="w-full">
      <CardHeader title="Novo usuário" />
      <div className="flex flex-col gap-3 px-5 py-4">
        {state.password ? (
          <div className="flex flex-col gap-2">
            <p className="rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">
              Usuário criado. Entregue a senha inicial — ela não será exibida de novo.
            </p>
            <p className="rounded-lg bg-surface-muted px-3 py-2 font-mono text-sm">{state.password}</p>
            <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
              Concluir
            </Button>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <FormError message={state.error} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome completo" required><Input name="full_name" required /></Field>
              <Field label="E-mail" required><Input name="email" type="email" required /></Field>
              <Field label="Perfil de acesso" required>
                <Select name="role" required defaultValue="ombudsman">
                  {ASSIGNABLE.map((role) => (
                    <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Departamento">
                <Select name="department_id" defaultValue="">
                  <option value="">Sem departamento</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Cargo"><Input name="job_title" /></Field>
              <Field label="Telefone"><Input name="phone" /></Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? 'Criando…' : 'Criar usuário'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  )
}

export function UserToggle({ id, active }: { id: string; active: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleUser(id, !active)
            setError(result.error ?? null)
          })
        }
      >
        {active ? 'Desativar' : 'Ativar'}
      </Button>
      {error ? <span className="text-[11px] text-danger">{error}</span> : null}
    </div>
  )
}

export function UserBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'ok' : 'neutral'}>{active ? 'Ativo' : 'Inativo'}</Badge>
}

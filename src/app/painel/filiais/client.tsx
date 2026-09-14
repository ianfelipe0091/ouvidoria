'use client'

import { useActionState, useState, useTransition } from 'react'

import { Badge, Button, Card, CardHeader, Field, FormError, Input } from '@/components/ui'
import { createBranch, toggleBranch, type Result } from './actions'

export function NewBranchForm() {
  const [state, action, pending] = useActionState<Result, FormData>(createBranch, {})
  const [open, setOpen] = useState(false)

  if (!open) {
    return <Button size="sm" onClick={() => setOpen(true)}>Nova filial</Button>
  }

  return (
    <Card className="w-full">
      <CardHeader title="Nova filial" />
      <form action={action} className="flex flex-col gap-3 px-5 py-4">
        <FormError message={state.error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome da filial" required><Input name="name" required /></Field>
          <Field label="Nome fantasia"><Input name="trade_name" /></Field>
          <Field label="CNPJ"><Input name="tax_id" inputMode="numeric" /></Field>
          <Field label="Código interno"><Input name="internal_code" /></Field>
          <Field label="Cidade"><Input name="address_city" /></Field>
          <Field label="UF"><Input name="address_state" maxLength={2} /></Field>
          <Field label="Telefone"><Input name="phone" /></Field>
          <Field label="E-mail"><Input name="email" type="email" /></Field>
          <Field label="Responsável" className="sm:col-span-2"><Input name="contact_name" /></Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar filial'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function BranchToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(() => { void toggleBranch(id, !active) })}
    >
      {active ? 'Desativar' : 'Ativar'}
    </Button>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'ok' : 'neutral'}>{active ? 'Ativa' : 'Inativa'}</Badge>
}

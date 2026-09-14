'use client'

import { useActionState, useState, useTransition } from 'react'

import { Badge, Button, FormError, Input } from '@/components/ui'
import { createCategory, createSubject, createType, toggleRecord, type Result } from './actions'

export function InlineCreate({
  kind, placeholder,
}: { kind: 'categoria' | 'tipo'; placeholder: string }) {
  const action = kind === 'categoria' ? createCategory : createType
  const [state, formAction, pending] = useActionState<Result, FormData>(action, {})

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <FormError message={state.error} />
      <div className="flex gap-2">
        <Input name="name" placeholder={placeholder} required aria-label={placeholder} />
        <Button type="submit" size="sm" disabled={pending}>Adicionar</Button>
      </div>
    </form>
  )
}

export function SubjectCreate({ categoryId }: { categoryId: string }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Novo assunto"
          aria-label="Novo assunto"
          className="text-xs"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || !name.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await createSubject(categoryId, name)
              if (!result.error) setName('')
              setError(result.error ?? null)
            })
          }
        >
          Adicionar
        </Button>
      </div>
      <FormError message={error} />
    </div>
  )
}

export function ToggleRecord({
  table, id, active,
}: {
  table: 'occurrence_types' | 'categories' | 'subjects'
  id: string
  active: boolean
}) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => { void toggleRecord(table, id, !active) })}
      className="text-[11px] text-muted underline underline-offset-4 disabled:opacity-50"
    >
      {active ? 'desativar' : 'ativar'}
    </button>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  if (active) return null
  return <Badge tone="neutral">Inativo</Badge>
}

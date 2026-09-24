'use client'

import { useActionState } from 'react'

import { Button, Field, FormError, Input } from '@/components/ui'
import { setNewPassword, type NewPasswordState } from './actions'

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<NewPasswordState, FormData>(setNewPassword, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.error} />

      <Field label="Nova senha" required hint="Pelo menos 10 caracteres.">
        <Input name="password" type="password" required autoComplete="new-password" minLength={10} />
      </Field>

      <Field label="Confirmar nova senha" required>
        <Input name="password_confirm" type="password" required autoComplete="new-password" />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar nova senha'}
      </Button>
    </form>
  )
}

'use client'

import { useActionState } from 'react'

import { Button, Field, FormError, Input } from '@/components/ui'
import { signIn, type SignInState } from './actions'

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.error} />

      <Field label="E-mail" required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@empresa.com.br"
        />
      </Field>

      <Field label="Senha" required>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

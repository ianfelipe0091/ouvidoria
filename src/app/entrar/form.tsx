'use client'

import { useActionState } from 'react'
import Link from 'next/link'

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

      <Link
        href="/esqueci-senha"
        className="-mt-1 self-end text-xs text-muted underline underline-offset-4 hover:text-foreground"
      >
        Esqueci minha senha
      </Link>

      <Button type="submit" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

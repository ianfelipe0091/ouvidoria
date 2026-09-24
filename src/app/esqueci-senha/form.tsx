'use client'

import { useActionState } from 'react'

import { Button, Field, FormError, Input } from '@/components/ui'
import { requestReset, type ResetRequestState } from './actions'

export function ResetRequestForm() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(requestReset, {})

  if (state.ok) {
    return (
      <p className="rounded-lg bg-ok-soft px-3 py-3 text-sm text-ok">
        Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha. Verifique
        também a caixa de spam. O link vale por 1 hora.
      </p>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.error} />

      <Field label="E-mail" required hint="O mesmo que você usa para entrar.">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@empresa.com.br"
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar link de recuperação'}
      </Button>
    </form>
  )
}

'use client'

import { useActionState, useState } from 'react'

import { Button, Card, Field, FormError, Input } from '@/components/ui'
import { formatCnpj, formatPhone, isValidCnpj } from '@/lib/validation'
import { signUp, type SignUpState } from './actions'

export function SignUpForm({ planSlug }: { planSlug: string }) {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUp, {})
  const [taxId, setTaxId] = useState('')
  const [phone, setPhone] = useState('')

  // O aviso aparece só quando o campo está completo: alertar a cada tecla
  // digitada faria o formulário parecer errado o tempo todo.
  const taxIdComplete = taxId.replace(/\D/g, '').length === 14
  const taxIdInvalid = taxIdComplete && !isValidCnpj(taxId)

  return (
    <Card className="p-5">
      <form action={action} className="flex flex-col gap-4">
        <FormError message={state.error} />
        <input type="hidden" name="plan" value={planSlug} />

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 text-xs font-semibold text-muted">Dados da empresa</legend>

          <Field label="Razão social" required>
            <Input name="legal_name" required autoComplete="organization" />
          </Field>

          <Field label="Nome fantasia" hint="Aparece no canal público. Se vazio, usamos a razão social.">
            <Input name="trade_name" />
          </Field>

          <Field label="CNPJ" required hint={taxIdInvalid ? undefined : 'Somente da empresa contratante.'}>
            <Input
              name="tax_id"
              required
              inputMode="numeric"
              value={taxId}
              onChange={(e) => setTaxId(formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              aria-invalid={taxIdInvalid || undefined}
            />
          </Field>
          {taxIdInvalid ? (
            <p className="-mt-2 text-xs text-danger">CNPJ inválido. Confira os dígitos.</p>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-4 border-t border-border pt-4">
          <legend className="mb-1 text-xs font-semibold text-muted">Responsável</legend>

          <Field label="Nome completo" required>
            <Input name="contact_name" required autoComplete="name" />
          </Field>

          <Field label="E-mail" required hint="Será o seu acesso à plataforma.">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>

          <Field label="Telefone">
            <Input
              name="phone"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              autoComplete="tel"
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-4 border-t border-border pt-4">
          <legend className="mb-1 text-xs font-semibold text-muted">Senha de acesso</legend>

          <Field label="Senha" required hint="Pelo menos 10 caracteres.">
            <Input name="password" type="password" required autoComplete="new-password" minLength={10} />
          </Field>

          <Field label="Confirmar senha" required>
            <Input name="password_confirm" type="password" required autoComplete="new-password" />
          </Field>
        </fieldset>

        <Button type="submit" disabled={pending || taxIdInvalid}>
          {pending ? 'Criando seu ambiente…' : 'Criar conta'}
        </Button>

        <p className="text-center text-xs text-muted">
          Ao criar a conta você concorda em usar a plataforma conforme os termos de serviço.
        </p>
      </form>
    </Card>
  )
}

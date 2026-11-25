'use client'

import { useActionState, useState } from 'react'

import { Icon } from '@/components/landing/icons'
import { sendContact, type ContactState } from './actions'

const INPUT =
  'w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm font-normal ' +
  'placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

export function ContactForm({ whatsappUrl }: { whatsappUrl: string | null }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, {})
  // Momento em que o formulário apareceu: envio em menos de 3 s é robô.
  const [startedAt] = useState(() => Date.now())

  if (state.ok) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 py-6">
        <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
          <Icon name="check" size={24} />
        </span>
        <h2 className="text-2xl font-bold">Mensagem enviada{state.firstName ? `, ${state.firstName}` : ''}!</h2>
        <p className="max-w-md leading-7 text-muted-foreground">
          Recebemos seu contato e vamos responder pelo e-mail ou telefone que você informou, em
          horário comercial. Se for urgente, chame no WhatsApp.
        </p>
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:bg-secondary"
          >
            <Icon name="message-circle" size={16} /> Conversar no WhatsApp
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {/* Armadilha para robôs: fora da tela e fora do Tab. Pessoas não veem. */}
      <input
        type="text"
        name="site_confirmacao_hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px opacity-0"
      />
      <input type="hidden" name="started_at" value={startedAt} />

      <Field label="Nome" required>
        <input name="name" required minLength={2} maxLength={120} autoComplete="name" className={INPUT} />
      </Field>
      <Field label="E-mail" required>
        <input name="email" type="email" required maxLength={200} autoComplete="email" className={INPUT} />
      </Field>
      <Field label="Telefone / WhatsApp">
        <input name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="(00) 00000-0000" className={INPUT} />
      </Field>
      <Field label="Empresa">
        <input name="company" maxLength={160} autoComplete="organization" className={INPUT} />
      </Field>
      <Field label="Mensagem" required className="sm:col-span-2">
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          placeholder="Conte como podemos ajudar: quantas unidades sua empresa tem, se quer uma demonstração, dúvidas sobre planos…"
          className={`${INPUT} min-h-36 resize-y`}
        />
      </Field>

      {state.error ? (
        <p role="alert" className="rounded-md bg-category-red/10 px-3.5 py-2.5 text-sm font-normal text-category-red sm:col-span-2">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {pending ? 'Enviando…' : 'Enviar mensagem'} <Icon name="arrow-right" size={16} />
        </button>
        <p className="text-xs text-muted-foreground">
          Usamos seus dados só para responder este contato.
        </p>
      </div>
    </form>
  )
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <span className="text-sm font-medium">
        {label}
        {required ? <span aria-hidden className="ml-0.5 text-category-red">*</span> : null}
      </span>
      {children}
    </label>
  )
}

'use client'

import { useActionState, useState, useTransition } from 'react'

import { Button, Card, Field, FormError, Input, Textarea } from '@/components/ui'
import { finishOnboarding, saveBranch, saveIdentity, type Result } from './actions'

export function IdentityStep({
  defaults,
}: {
  defaults: {
    channel_name: string
    logo_url: string
    primary_color: string
    secondary_color: string
    intro_text: string
  }
}) {
  const [state, action, pending] = useActionState<Result, FormData>(saveIdentity, {})
  const [color, setColor] = useState(defaults.primary_color)
  const [name, setName] = useState(defaults.channel_name)

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_16rem]">
      <Card className="p-5">
        <form action={action} className="flex flex-col gap-4">
          <FormError message={state.error} />

          <Field label="Nome exibido no canal" required hint="É o que o manifestante lê no topo da página.">
            <Input name="channel_name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>

          <Field label="URL do logo" hint="Opcional. Endereço de uma imagem já hospedada.">
            <Input name="logo_url" defaultValue={defaults.logo_url} placeholder="https://…" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cor principal">
              <Input
                name="primary_color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 p-1"
              />
            </Field>
            <Field label="Cor secundária">
              <Input
                name="secondary_color"
                type="color"
                defaultValue={defaults.secondary_color}
                className="h-10 p-1"
              />
            </Field>
          </div>

          <Field label="Texto de apresentação" hint="Explique para que serve o canal. Pode ajustar depois.">
            <Textarea name="intro_text" defaultValue={defaults.intro_text} />
          </Field>

          <Button type="submit" disabled={pending} className="self-start">
            {pending ? 'Salvando…' : 'Continuar'}
          </Button>
        </form>
      </Card>

      {/* Prévia ao vivo: escolher cor sem ver o resultado é chute. */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted">Prévia do canal</p>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-surface px-3 py-2 text-xs font-semibold">
            Ouvidoria <span className="text-muted">| {name || 'Sua empresa'}</span>
          </div>
          <div className="flex flex-col gap-2 bg-surface p-3">
            <div className="h-1.5 w-3/4 rounded bg-surface-muted" />
            <div className="h-1.5 w-full rounded bg-surface-muted" />
            <div className="h-1.5 w-2/3 rounded bg-surface-muted" />
            <div
              className="mt-2 rounded-lg px-3 py-2 text-center text-xs font-medium text-white"
              style={{ backgroundColor: color }}
            >
              Registrar manifestação
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BranchStep({
  defaults,
}: {
  defaults: { name: string; address_city: string; address_state: string; phone: string; email: string }
}) {
  const [state, action, pending] = useActionState<Result, FormData>(saveBranch, {})

  return (
    <Card className="p-5">
      <form action={action} className="flex flex-col gap-4">
        <FormError message={state.error} />
        <p className="text-xs text-muted">
          Criamos a matriz junto com a sua conta. Confirme os dados — outras unidades
          você cadastra depois, em Filiais.
        </p>

        <Field label="Nome da unidade" required>
          <Input name="name" defaultValue={defaults.name} required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
          <Field label="Cidade">
            <Input name="address_city" defaultValue={defaults.address_city} />
          </Field>
          <Field label="UF">
            <Input name="address_state" defaultValue={defaults.address_state} maxLength={2} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone"><Input name="phone" defaultValue={defaults.phone} /></Field>
          <Field label="E-mail"><Input name="email" type="email" defaultValue={defaults.email} /></Field>
        </div>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? 'Salvando…' : 'Continuar'}
        </Button>
      </form>
    </Card>
  )
}

export function DoneStep({ channelUrl }: { channelUrl: string }) {
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-ok">Tudo pronto</h2>
        <p className="text-xs text-muted">
          Seu canal já está no ar. Divulgue o endereço abaixo para começar a receber
          manifestações.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-muted p-3">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{channelUrl}</code>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(channelUrl).then(() => setCopied(true))
          }}
        >
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>

      <ul className="flex flex-col gap-1.5 text-xs text-muted">
        <li>· Os tipos de manifestação e as categorias padrão já estão criados.</li>
        <li>· Convide sua equipe em <strong className="text-foreground">Usuários</strong>.</li>
        <li>· Ajuste prazos e anonimato em <strong className="text-foreground">Configurações</strong>.</li>
      </ul>

      <Button
        className="self-start"
        disabled={pending}
        onClick={() => startTransition(() => { void finishOnboarding() })}
      >
        {pending ? 'Abrindo…' : 'Ir para o painel'}
      </Button>
    </Card>
  )
}

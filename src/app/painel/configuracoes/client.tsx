'use client'

import { useActionState } from 'react'

import { Button, Card, CardHeader, Field, FormError, Input, Textarea } from '@/components/ui'
import { saveSettings, type Result } from './actions'

type Props = {
  company: { trade_name: string | null; email: string; phone: string | null; website: string | null; slug: string }
  settings: {
    channel_name: string | null
    logo_url: string | null
    primary_color: string
    secondary_color: string
    intro_text: string | null
    privacy_policy_text: string | null
    notification_email: string | null
    default_sla_days: number
    sla_warning_days: number
    allow_anonymous: boolean
    allow_attachments: boolean
    allow_rating: boolean
  }
}

export function SettingsForm({ company, settings }: Props) {
  const [state, action, pending] = useActionState<Result, FormData>(saveSettings, {})

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? <FormError message={state.error} /> : null}
      {state.ok ? (
        <p className="rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">Configurações salvas.</p>
      ) : null}

      <Card>
        <CardHeader title="Dados da empresa" />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Nome fantasia">
            <Input name="trade_name" defaultValue={company.trade_name ?? ''} />
          </Field>
          <Field label="E-mail principal">
            <Input name="email" type="email" defaultValue={company.email} />
          </Field>
          <Field label="Telefone"><Input name="phone" defaultValue={company.phone ?? ''} /></Field>
          <Field label="Site"><Input name="website" defaultValue={company.website ?? ''} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Identidade do canal"
          description={`Endereço público: /ouvidoria/${company.slug}`}
        />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Nome exibido na ouvidoria">
            <Input name="channel_name" defaultValue={settings.channel_name ?? ''} />
          </Field>
          <Field label="URL do logo">
            <Input name="logo_url" defaultValue={settings.logo_url ?? ''} placeholder="https://…" />
          </Field>
          <Field label="Cor principal">
            <Input name="primary_color" type="color" defaultValue={settings.primary_color} className="h-10 p-1" />
          </Field>
          <Field label="Cor secundária">
            <Input name="secondary_color" type="color" defaultValue={settings.secondary_color} className="h-10 p-1" />
          </Field>
          <Field label="Texto de apresentação" className="sm:col-span-2">
            <Textarea name="intro_text" defaultValue={settings.intro_text ?? ''} />
          </Field>
          <Field label="Política de privacidade" className="sm:col-span-2">
            <Textarea name="privacy_policy_text" defaultValue={settings.privacy_policy_text ?? ''} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Prazos e opções" />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Prazo padrão de resposta (dias)">
            <Input name="default_sla_days" type="number" min={1} max={365} defaultValue={settings.default_sla_days} />
          </Field>
          <Field label="Avisar quantos dias antes do vencimento">
            <Input name="sla_warning_days" type="number" min={0} defaultValue={settings.sla_warning_days} />
          </Field>
          <Field label="E-mail para notificações" className="sm:col-span-2">
            <Input name="notification_email" type="email" defaultValue={settings.notification_email ?? ''} />
          </Field>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Toggle name="allow_anonymous" defaultChecked={settings.allow_anonymous} label="Aceitar manifestações anônimas" />
            <Toggle name="allow_attachments" defaultChecked={settings.allow_attachments} label="Permitir anexos" />
            <Toggle name="allow_rating" defaultChecked={settings.allow_rating} label="Pedir avaliação do atendimento após o encerramento" />
          </div>
        </div>
      </Card>

      <Button type="submit" className="self-start" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar configurações'}
      </Button>
    </form>
  )
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  )
}

'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'

import { Button, Card, Field, FormError, Input, Select, Textarea, cn } from '@/components/ui'
import type { Channel } from '@/lib/channel'
import { submitManifestacao, type SubmitResult } from './actions'

type StepId = 'identificacao' | 'tipo' | 'local' | 'assunto' | 'relato' | 'contato' | 'revisao'

export function RegistrationForm({ channel }: { channel: Channel }) {
  const [isAnonymous, setIsAnonymous] = useState<boolean | null>(
    // Sem anonimato permitido a pergunta não faz sentido: já entra identificado.
    channel.options.allow_anonymous ? null : false,
  )
  const [typeId, setTypeId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [description, setDescription] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [occurredLocation, setOccurredLocation] = useState('')
  const [peopleInvolved, setPeopleInvolved] = useState('')
  const [name, setName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [stepIndex, setStepIndex] = useState(0)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [pending, startTransition] = useTransition()

  // As etapas dependem de como a empresa configurou o canal: sem filiais
  // cadastradas, não faz sentido perguntar a unidade.
  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = []
    if (channel.options.allow_anonymous) list.push('identificacao')
    if (channel.types.length) list.push('tipo')
    if (channel.branches.length) list.push('local')
    if (channel.categories.length) list.push('assunto')
    list.push('relato')
    if (isAnonymous === false) list.push('contato')
    list.push('revisao')
    return list
  }, [channel, isAnonymous])

  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const subjects = channel.categories.find((c) => c.id === categoryId)?.subjects ?? []

  const canAdvance = (() => {
    switch (step) {
      case 'identificacao':
        return isAnonymous !== null
      case 'relato':
        return description.trim().length >= 10
      case 'contato':
        return name.trim().length > 0
      default:
        return true
    }
  })()

  function submit() {
    startTransition(async () => {
      setResult(
        await submitManifestacao({
          slug: channel.company.slug,
          description,
          typeId: typeId || null,
          branchId: branchId || null,
          categoryId: categoryId || null,
          subjectId: subjectId || null,
          isAnonymous: isAnonymous ?? false,
          reporterName: isAnonymous ? null : name,
          reporterTaxId: isAnonymous ? null : taxId,
          reporterEmail: isAnonymous ? null : email,
          reporterPhone: isAnonymous ? null : phone,
          reporterWhatsapp: null,
          occurredAt: occurredAt || null,
          occurredLocation: occurredLocation || null,
          peopleInvolved: peopleInvolved || null,
          hasWitnesses: null,
        }),
      )
    })
  }

  if (result?.ok) {
    return <Receipt result={result} slug={channel.company.slug} />
  }

  const typeName = channel.types.find((t) => t.id === typeId)?.name
  const branchName = channel.branches.find((b) => b.id === branchId)?.name
  const categoryName = channel.categories.find((c) => c.id === categoryId)?.name
  const subjectName = subjects.find((s) => s.id === subjectId)?.name

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Etapas">
        {steps.map((id, index) => (
          <li
            key={id}
            aria-current={index === stepIndex ? 'step' : undefined}
            className={cn(
              'h-1 flex-1 rounded-full transition',
              index < stepIndex ? 'bg-accent' : index === stepIndex ? 'bg-accent' : 'bg-border',
              index > stepIndex && 'opacity-60',
            )}
          >
            <span className="sr-only">{`Etapa ${index + 1} de ${steps.length}`}</span>
          </li>
        ))}
      </ol>

      <Card className="flex flex-col gap-5 p-5">
        {result && !result.ok ? <FormError message={result.error} /> : null}

        {step === 'identificacao' ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold">Como você deseja se identificar?</legend>
            <p className="text-xs text-muted">
              A escolha não muda a forma como a manifestação é tratada.
            </p>
            <Choice
              selected={isAnonymous === false}
              onSelect={() => setIsAnonymous(false)}
              title="Quero me identificar"
              description="Permite que a ouvidoria entre em contato e que você avalie o atendimento."
            />
            <Choice
              selected={isAnonymous === true}
              onSelect={() => setIsAnonymous(true)}
              title="Quero permanecer anônimo"
              description="Nenhum dado pessoal é solicitado ou armazenado. O acompanhamento é feito só pelo protocolo e pelo código."
            />
          </fieldset>
        ) : null}

        {step === 'tipo' ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold">
              Qual tipo de manifestação deseja registrar?
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {channel.types.map((type) => (
                <Choice
                  key={type.id}
                  selected={typeId === type.id}
                  onSelect={() => setTypeId(type.id)}
                  title={type.name}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === 'local' ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Onde ocorreu?</h2>
            <Field label="Unidade relacionada à manifestação">
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Não sei informar</option>
                {channel.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                    {branch.city ? ` — ${branch.city}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        {step === 'assunto' ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Sobre o que é?</h2>
            <Field label="Categoria">
              <Select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value)
                  setSubjectId('')
                }}
              >
                <option value="">Não sei informar</option>
                {channel.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            {subjects.length ? (
              <Field label="Assunto">
                <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">Não sei informar</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        ) : null}

        {step === 'relato' ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">Conte-nos o que aconteceu</h2>
            <Field
              label="Relato"
              required
              hint={`${description.trim().length} caracteres — mínimo de 10.`}
            >
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-44"
                placeholder="Descreva o ocorrido com o máximo de detalhes que puder."
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data do ocorrido">
                <Input
                  type="date"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                />
              </Field>
              <Field label="Local do ocorrido">
                <Input
                  value={occurredLocation}
                  onChange={(e) => setOccurredLocation(e.target.value)}
                  placeholder="Setor, sala, endereço…"
                />
              </Field>
            </div>
            <Field label="Pessoas ou área envolvidas" hint="Opcional.">
              <Input
                value={peopleInvolved}
                onChange={(e) => setPeopleInvolved(e.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {step === 'contato' ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">Seus dados</h2>
            <p className="text-xs text-muted">
              Usados apenas para tratar e responder esta manifestação.
            </p>
            <Field label="Nome completo" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-mail">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </Field>
            </div>
            <Field label="CPF" hint="Opcional.">
              <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} inputMode="numeric" />
            </Field>
          </div>
        ) : null}

        {step === 'revisao' ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">Confira antes de enviar</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
              <Row label="Identificação" value={isAnonymous ? 'Anônima' : name || '—'} />
              {typeName ? <Row label="Tipo" value={typeName} /> : null}
              {branchName ? <Row label="Unidade" value={branchName} /> : null}
              {categoryName ? <Row label="Categoria" value={categoryName} /> : null}
              {subjectName ? <Row label="Assunto" value={subjectName} /> : null}
              <Row label="Relato" value={description} />
            </dl>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0 || pending}
          >
            Voltar
          </Button>

          {step === 'revisao' ? (
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? 'Enviando…' : 'Enviar manifestação'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setStepIndex((i) => i + 1)}
              disabled={!canAdvance}
            >
              Continuar
            </Button>
          )}
        </div>
      </Card>

      <p className="text-xs text-muted">
        Prefere consultar algo já registrado?{' '}
        <Link
          href={`/ouvidoria/${channel.company.slug}/consultar`}
          className="underline underline-offset-4"
        >
          Consultar manifestação
        </Link>
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </>
  )
}

function Choice({
  selected,
  onSelect,
  title,
  description,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description?: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex flex-col gap-1 rounded-lg border p-3 text-left transition',
        selected ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-muted',
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      {description ? <span className="text-xs text-muted">{description}</span> : null}
    </button>
  )
}

/** Comprovante. É a única vez que o código de acompanhamento existe em texto. */
function Receipt({
  result,
  slug,
}: {
  result: Extract<SubmitResult, { ok: true }>
  slug: string
}) {
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-ok">Manifestação registrada</h2>
          <p className="text-xs text-muted">
            Prazo de resposta até{' '}
            {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(result.dueAt))}.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-muted p-3">
            <p className="text-xs text-muted">Protocolo</p>
            <p className="mt-1 font-mono text-sm font-semibold">{result.protocol}</p>
          </div>
          <div className="rounded-lg bg-surface-muted p-3">
            <p className="text-xs text-muted">Código de acompanhamento</p>
            <p className="mt-1 font-mono text-sm font-semibold">{result.trackingCode}</p>
          </div>
        </div>

        <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
          <strong className="font-semibold">Guarde os dois agora.</strong> O código não é enviado
          por e-mail nem pode ser recuperado depois — é ele que protege sua manifestação, inclusive
          se você a registrou de forma anônima.
        </p>
      </Card>

      <Link
        href={`/ouvidoria/${slug}/consultar`}
        className="text-xs underline underline-offset-4"
      >
        Acompanhar esta manifestação
      </Link>
    </div>
  )
}

'use client'

import { useActionState, useState, useTransition } from 'react'

import { Button, Field, FormError, Input, Select } from '@/components/ui'
import type { Database } from '@/lib/supabase/database.types'
import {
  deleteCompany, markOverdue, registerPayment, setCompanyPlan, setCompanyStatus,
  updateBilling, updateCompany, type Result,
} from '../../actions'

type CompanyStatus = Database['public']['Enums']['company_status']
type SubscriptionStatus = Database['public']['Enums']['subscription_status']

/** ISO → AAAA-MM-DD no fuso de Brasília, para <input type="date">. */
const toDateInput = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : ''

const money = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Success({ message }: { message?: string }) {
  if (!message) return null
  return <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok">{message}</p>
}

// ------------------------------------------------------------------ plano --

export function PlanSelect({
  companyId, planSlug, plans,
}: {
  companyId: string
  planSlug: string
  plans: Array<{ slug: string; name: string }>
}) {
  const [result, setResult] = useState<Result>({})
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="plan-select" className="text-xs font-medium">Trocar plano</label>
        <Select
          id="plan-select"
          defaultValue={planSlug}
          disabled={pending}
          className="w-auto! py-1.5 text-sm"
          onChange={(e) => {
            const slug = e.target.value
            startTransition(async () => setResult(await setCompanyPlan(companyId, slug)))
          }}
        >
          {plans.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </Select>
        <span className="text-xs text-muted">Troca o plano e o valor de tabela; não mexe no período pago.</span>
      </div>
      <FormError message={result.error} />
      <Success message={result.message} />
    </div>
  )
}

// ------------------------------------------------------------- pagamento --

export function PaymentForm({
  companyId, suggestedAmount, today,
}: {
  companyId: string
  suggestedAmount: number | null
  today: string
}) {
  const [state, action, pending] = useActionState<Result, FormData>(
    registerPayment.bind(null, companyId), {},
  )

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg bg-surface-muted p-4">
      <div>
        <p className="text-sm font-semibold">Registrar pagamento</p>
        <p className="text-xs text-muted">
          Libera o acesso e estende o período pago. Se ainda houver dias pagos, a extensão
          começa depois deles.
        </p>
      </div>
      <FormError message={state.error} />
      <Success message={state.message} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Valor recebido (R$)" required>
          <Input
            name="amount"
            inputMode="decimal"
            required
            placeholder="149,00"
            defaultValue={suggestedAmount !== null ? money(suggestedAmount) : ''}
          />
        </Field>
        <Field label="Meses pagos" required>
          <Select name="months" defaultValue="1">
            <option value="1">1 mês</option>
            <option value="3">3 meses</option>
            <option value="6">6 meses</option>
            <option value="12">12 meses</option>
          </Select>
        </Field>
        <Field label="Forma">
          <Select name="method" defaultValue="pix">
            <option value="pix">Pix</option>
            <option value="boleto">Boleto</option>
            <option value="transferencia">Transferência</option>
            <option value="cartao">Cartão</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="outro">Outro</option>
          </Select>
        </Field>
        <Field label="Data do pagamento" required>
          <Input name="paid_at" type="date" required defaultValue={today} />
        </Field>
      </div>
      <Field label="Observação" hint="Ex.: nº do comprovante ou quem pagou.">
        <Input name="note" maxLength={200} />
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Registrando…' : 'Registrar pagamento'}
      </Button>
    </form>
  )
}

// -------------------------------------------------------------- cobrança --

export function BillingForm({
  companyId, contractedPrice, currentPeriodEnd, trialEndsAt, graceUntil,
}: {
  companyId: string
  contractedPrice: number
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  graceUntil: string | null
}) {
  const [state, action, pending] = useActionState<Result, FormData>(
    updateBilling.bind(null, companyId), {},
  )

  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError message={state.error} />
      <Success message={state.message} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Valor mensal contratado (R$)" required hint="Para plano negociado, o valor fechado.">
          <Input name="contracted_price" inputMode="decimal" required defaultValue={money(contractedPrice)} />
        </Field>
        <Field label="Pago até" hint="Vazio = sem período pago.">
          <Input name="current_period_end" type="date" defaultValue={toDateInput(currentPeriodEnd)} />
        </Field>
        <Field label="Fim da avaliação" hint="Estenda para dar mais dias de teste.">
          <Input name="trial_ends_at" type="date" defaultValue={toDateInput(trialEndsAt)} />
        </Field>
        <Field label="Tolerância até" hint="Só vale para inadimplente. Vazio = sem prazo.">
          <Input name="grace_until" type="date" defaultValue={toDateInput(graceUntil)} />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        {pending ? 'Salvando…' : 'Salvar ajustes'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------- acesso --

export function AccessActions({
  companyId, companyStatus, subscriptionStatus,
}: {
  companyId: string
  companyStatus: CompanyStatus
  subscriptionStatus: SubscriptionStatus | null
}) {
  const [error, setError] = useState<string | null>(null)
  const [grace, setGrace] = useState('5')
  const [pending, startTransition] = useTransition()

  const run = (question: string | null, fn: () => Promise<Result>) => {
    if (question && !window.confirm(question)) return
    startTransition(async () => setError((await fn()).error ?? null))
  }

  if (companyStatus !== 'ativa') {
    const label = {
      suspensa: 'Acesso suspenso: painel bloqueado e canal público fora do ar.',
      bloqueada: 'Bloqueio administrativo: painel bloqueado e canal público fora do ar.',
      cancelada: 'Conta cancelada: painel bloqueado e canal público fora do ar.',
    }[companyStatus]
    return (
      <div className="flex flex-col gap-3">
        <FormError message={error} />
        <p className="text-sm text-danger">{label}</p>
        <Button
          disabled={pending}
          onClick={() =>
            run('Reativar esta empresa? O painel e o canal público voltam a funcionar.', () =>
              // Em avaliação, reativar não deve transformar a avaliação em
              // assinatura paga: só volta o acesso.
              setCompanyStatus(companyId, 'ativa', subscriptionStatus === 'trial' ? undefined : 'ativa'),
            )
          }
        >
          Reativar empresa
        </Button>
        <p className="text-xs text-muted">
          Se o motivo foi falta de pagamento, prefira “Registrar pagamento”: ele reativa e já
          estende o período pago.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError message={error} />

      {subscriptionStatus === 'inadimplente' ? (
        <div className="flex flex-col gap-1.5">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => run(null, () => setCompanyStatus(companyId, 'ativa', 'ativa'))}
          >
            Retirar inadimplência
          </Button>
          <p className="text-xs text-muted">Volta a assinatura para em dia, sem lançar pagamento.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Select
              aria-label="Dias de tolerância"
              value={grace}
              onChange={(e) => setGrace(e.target.value)}
              className="w-auto! py-1.5 text-sm"
            >
              <option value="0">Sem tolerância</option>
              <option value="3">3 dias</option>
              <option value="5">5 dias</option>
              <option value="7">7 dias</option>
              <option value="15">15 dias</option>
            </Select>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(
                  grace === '0'
                    ? 'Marcar inadimplente sem tolerância? O painel do cliente bloqueia agora.'
                    : null,
                  () => markOverdue(companyId, Number(grace)),
                )
              }
            >
              Marcar inadimplente
            </Button>
          </div>
          <p className="text-xs text-muted">
            O cliente segue usando durante a tolerância; vencida, o painel bloqueia sozinho.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            run('Suspender agora? O painel bloqueia e o canal público sai do ar imediatamente.', () =>
              setCompanyStatus(companyId, 'suspensa', subscriptionStatus === 'trial' ? undefined : 'inadimplente'),
            )
          }
        >
          Suspender por falta de pagamento
        </Button>
        <p className="text-xs text-muted">Registrar um pagamento reativa automaticamente.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            run('Bloquear esta empresa? Painel e canal público saem do ar até você reativar.', () =>
              setCompanyStatus(companyId, 'bloqueada'),
            )
          }
        >
          Bloquear (outro motivo)
        </Button>
        <p className="text-xs text-muted">Bloqueio administrativo. Só sai reativando manualmente.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            run('Cancelar a conta desta empresa? Os dados continuam guardados.', () =>
              setCompanyStatus(companyId, 'cancelada', 'cancelada'),
            )
          }
        >
          Cancelar conta
        </Button>
      </div>
    </div>
  )
}

// ------------------------------------------------------ dados cadastrais --

type CompanyValues = Record<
  | 'legal_name' | 'trade_name' | 'tax_id' | 'email' | 'phone' | 'whatsapp' | 'website'
  | 'contact_name' | 'contact_email' | 'contact_phone'
  | 'address_street' | 'address_number' | 'address_complement' | 'address_district'
  | 'address_city' | 'address_state' | 'address_zip',
  string
>

export function CompanyForm({ companyId, values }: { companyId: string; values: CompanyValues }) {
  const [state, action, pending] = useActionState<Result, FormData>(
    updateCompany.bind(null, companyId), {},
  )

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.error} />
      <Success message={state.message} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Razão social" required>
          <Input name="legal_name" required defaultValue={values.legal_name} />
        </Field>
        <Field label="Nome fantasia">
          <Input name="trade_name" defaultValue={values.trade_name} />
        </Field>
        <Field label="CNPJ" required>
          <Input name="tax_id" required inputMode="numeric" defaultValue={values.tax_id} />
        </Field>
        <Field label="E-mail da empresa" required>
          <Input name="email" type="email" required defaultValue={values.email} />
        </Field>
        <Field label="Telefone">
          <Input name="phone" defaultValue={values.phone} />
        </Field>
        <Field label="WhatsApp">
          <Input name="whatsapp" defaultValue={values.whatsapp} />
        </Field>
        <Field label="Site" className="sm:col-span-2">
          <Input name="website" defaultValue={values.website} />
        </Field>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-xs font-semibold text-muted">Responsável</legend>
        <Field label="Nome">
          <Input name="contact_name" defaultValue={values.contact_name} />
        </Field>
        <Field label="E-mail">
          <Input name="contact_email" type="email" defaultValue={values.contact_email} />
        </Field>
        <Field label="Telefone">
          <Input name="contact_phone" defaultValue={values.contact_phone} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-6">
        <legend className="mb-1 text-xs font-semibold text-muted">Endereço</legend>
        <Field label="Rua" className="sm:col-span-4">
          <Input name="address_street" defaultValue={values.address_street} />
        </Field>
        <Field label="Número" className="sm:col-span-2">
          <Input name="address_number" defaultValue={values.address_number} />
        </Field>
        <Field label="Complemento" className="sm:col-span-2">
          <Input name="address_complement" defaultValue={values.address_complement} />
        </Field>
        <Field label="Bairro" className="sm:col-span-2">
          <Input name="address_district" defaultValue={values.address_district} />
        </Field>
        <Field label="CEP" className="sm:col-span-2">
          <Input name="address_zip" defaultValue={values.address_zip} />
        </Field>
        <Field label="Cidade" className="sm:col-span-4">
          <Input name="address_city" defaultValue={values.address_city} />
        </Field>
        <Field label="UF" className="sm:col-span-2">
          <Input name="address_state" maxLength={2} defaultValue={values.address_state} />
        </Field>
      </fieldset>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Salvando…' : 'Salvar dados'}
      </Button>
    </form>
  )
}

// --------------------------------------------------------------- exclusão --

export function DeleteCompany({ companyId, slug }: { companyId: string; slug: string }) {
  const [typed, setTyped] = useState('')
  const [state, action, pending] = useActionState<Result, FormData>(
    deleteCompany.bind(null, companyId), {},
  )

  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (!window.confirm('Excluir DEFINITIVAMENTE esta empresa e todos os dados dela?')) {
          e.preventDefault()
        }
      }}
    >
      <FormError message={state.error} />
      <Field label={`Digite ${slug} para confirmar`}>
        <Input
          name="confirm_slug"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="danger" disabled={pending || typed !== slug}>
        {pending ? 'Excluindo…' : 'Excluir empresa'}
      </Button>
    </form>
  )
}

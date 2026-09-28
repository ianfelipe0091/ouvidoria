import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge, Card, CardHeader, EmptyState } from '@/components/ui'
import { requirePlatformAdmin } from '@/lib/auth'
import { billingSituation } from '@/lib/billing-situation'
import { formatLimit, formatMoney } from '@/lib/brand'
import { ROLE_LABEL, formatDate, formatDateTime } from '@/lib/domain'
import {
  AccessActions, BillingForm, CompanyForm, DeleteCompany, PaymentForm, PlanSelect,
} from './client'

/** Rótulos do histórico de ações do administrador da plataforma. */
const ACTION_LABEL: Record<string, string> = {
  'admin.registrar_pagamento': 'Pagamento registrado',
  'admin.editar_cobranca': 'Cobrança ajustada',
  'admin.editar_empresa': 'Dados da empresa editados',
  'admin.situacao': 'Situação alterada',
  'admin.inadimplente': 'Marcada como inadimplente',
  'admin.trocar_plano': 'Plano alterado',
}

const METHOD_LABEL: Record<string, string> = {
  pix: 'Pix', boleto: 'Boleto', transferencia: 'Transferência', cartao: 'Cartão',
  dinheiro: 'Dinheiro', outro: 'Outro',
}

const INVOICE_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  paga: { label: 'Paga', tone: 'ok' },
  aberta: { label: 'Em aberto', tone: 'warn' },
  falhou: { label: 'Falhou', tone: 'danger' },
  estornada: { label: 'Estornada', tone: 'neutral' },
  cancelada: { label: 'Cancelada', tone: 'neutral' },
}

export default async function CompanyAdminPage(props: PageProps<'/master/empresas/[id]'>) {
  const { id } = await props.params
  const { supabase } = await requirePlatformAdmin()

  const [company, subscription, plans, invoices, users, usage, occurrences, history] =
    await Promise.all([
      supabase.from('companies').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('subscriptions')
        .select('*, plans(slug, name, monthly_price, self_service, max_branches, max_users)')
        .eq('company_id', id)
        .maybeSingle(),
      supabase.from('plans').select('slug, name').eq('is_active', true).order('sort_order'),
      supabase.from('invoices').select('*').eq('company_id', id).order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, email, role, status, created_at')
        .eq('company_id', id)
        .order('created_at'),
      supabase.rpc('company_usage', { p_company_id: id }),
      supabase.from('occurrences').select('id', { count: 'exact', head: true }).eq('company_id', id),
      supabase
        .from('audit_logs')
        .select('id, action, actor_email, changes, created_at')
        .eq('company_id', id)
        .like('action', 'admin.%')
        .order('created_at', { ascending: false })
        .limit(30),
    ])

  const c = company.data
  if (!c) notFound()

  const sub = subscription.data
  const plan = sub?.plans ?? null
  const situation = billingSituation({ companyStatus: c.status, subscription: sub })
  const used = (usage.data ?? {}) as { branches?: number; users?: number; occurrences_month?: number }
  const negotiated = plan ? !plan.self_service && Number(sub?.contracted_price ?? 0) === 0 : false

  return (
    <div className="flex flex-col gap-5">
      <Link href="/master" className="text-xs text-muted underline underline-offset-4">
        ← Todas as empresas
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{c.trade_name ?? c.legal_name}</h1>
          <p className="mt-1 text-sm text-muted">
            {c.legal_name} · CNPJ <span className="font-mono">{c.tax_id}</span> · cliente desde{' '}
            {formatDate(c.created_at)}
          </p>
          <a
            href={`/${c.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-accent underline underline-offset-4"
          >
            nossaouvidoria.com.br/{c.slug}
          </a>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={situation.tone}>{situation.label}</Badge>
          {situation.detail ? <span className="text-xs text-muted">{situation.detail}</span> : null}
          {situation.blocked ? (
            <span className="text-xs text-danger">Painel do cliente bloqueado</span>
          ) : null}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* ---------------------------------------------------- cobrança */}
          <Card>
            <CardHeader
              title="Cobrança"
              description="A cobrança é manual: confirme o pagamento aqui para liberar ou estender o acesso."
            />
            {sub && plan ? (
              <div className="flex flex-col gap-5 px-5 py-4">
                <dl className="grid gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted">Plano</dt>
                    <dd className="mt-0.5 font-medium">{plan.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Valor mensal</dt>
                    <dd className="mt-0.5 font-medium">
                      {negotiated ? 'A definir' : formatMoney(sub.contracted_price)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">
                      {sub.status === 'trial' ? 'Avaliação até' : 'Pago até'}
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      {sub.status === 'trial'
                        ? sub.trial_ends_at ? formatDate(sub.trial_ends_at) : '—'
                        : sub.current_period_end ? formatDate(sub.current_period_end) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Tolerância</dt>
                    <dd className="mt-0.5 font-medium">
                      {sub.grace_until ? `até ${formatDate(sub.grace_until)}` : '—'}
                    </dd>
                  </div>
                </dl>

                <PlanSelect companyId={c.id} planSlug={plan.slug} plans={plans.data ?? []} />

                <PaymentForm
                  companyId={c.id}
                  suggestedAmount={Number(sub.contracted_price) > 0 ? Number(sub.contracted_price) : null}
                  today={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}
                />

                <details className="rounded-lg border border-border">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                    Ajustar valor, vencimento, avaliação e tolerância
                  </summary>
                  <div className="border-t border-border px-4 py-4">
                    <BillingForm
                      companyId={c.id}
                      contractedPrice={Number(sub.contracted_price)}
                      currentPeriodEnd={sub.current_period_end}
                      trialEndsAt={sub.trial_ends_at}
                      graceUntil={sub.grace_until}
                    />
                  </div>
                </details>
              </div>
            ) : (
              <EmptyState title="Empresa sem assinatura" />
            )}
          </Card>

          {/* ------------------------------------------------------ faturas */}
          <Card className="overflow-hidden">
            <CardHeader title="Pagamentos" description="Faturas lançadas para esta empresa." />
            {!invoices.data?.length ? (
              <EmptyState
                title="Nenhum pagamento registrado"
                description="Os pagamentos confirmados aparecem aqui."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">Fatura</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Pago em</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Período</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Forma</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Valor</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.data.map((inv) => {
                      const st = INVOICE_LABEL[inv.status] ?? { label: inv.status, tone: 'neutral' as const }
                      return (
                        <tr key={inv.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-xs">{inv.number ?? '—'}</span>
                            {inv.note ? <span className="block text-[11px] text-muted">{inv.note}</span> : null}
                          </td>
                          <td className="px-4 py-2.5 text-xs">{inv.paid_at ? formatDate(inv.paid_at) : '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-muted">
                            {inv.period_start && inv.period_end
                              ? `${formatDate(inv.period_start)} → ${formatDate(inv.period_end)}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {inv.method ? METHOD_LABEL[inv.method] ?? inv.method : inv.provider}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                            {formatMoney(inv.amount_cents / 100)}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ------------------------------------------------ dados cadastrais */}
          <Card>
            <CardHeader
              title="Dados da empresa"
              description="O endereço do canal (apelido) não muda: links e QR codes já distribuídos quebrariam."
            />
            <div className="px-5 py-4">
              <CompanyForm
                companyId={c.id}
                values={{
                  legal_name: c.legal_name,
                  trade_name: c.trade_name ?? '',
                  tax_id: c.tax_id,
                  email: c.email,
                  phone: c.phone ?? '',
                  whatsapp: c.whatsapp ?? '',
                  website: c.website ?? '',
                  contact_name: c.contact_name ?? '',
                  contact_email: c.contact_email ?? '',
                  contact_phone: c.contact_phone ?? '',
                  address_street: c.address_street ?? '',
                  address_number: c.address_number ?? '',
                  address_complement: c.address_complement ?? '',
                  address_district: c.address_district ?? '',
                  address_city: c.address_city ?? '',
                  address_state: c.address_state ?? '',
                  address_zip: c.address_zip ?? '',
                }}
              />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          {/* ------------------------------------------------------- acesso */}
          <Card>
            <CardHeader title="Acesso" description="Liberar ou bloquear o painel e o canal público." />
            <div className="px-5 py-4">
              <AccessActions companyId={c.id} companyStatus={c.status} subscriptionStatus={sub?.status ?? null} />
            </div>
          </Card>

          {/* --------------------------------------------------------- uso */}
          <Card>
            <CardHeader title="Uso" />
            <dl className="grid grid-cols-3 gap-3 px-5 py-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Filiais</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {formatLimit(used.branches ?? 0, plan?.max_branches ?? null)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Usuários</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {formatLimit(used.users ?? 0, plan?.max_users ?? null)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Manifestações</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{occurrences.count ?? 0}</dd>
              </div>
            </dl>
          </Card>

          {/* ---------------------------------------------------- usuários */}
          <Card>
            <CardHeader title="Usuários" description="Quem acessa o painel desta empresa." />
            {!users.data?.length ? (
              <EmptyState title="Nenhum usuário" />
            ) : (
              <ul className="divide-y divide-border">
                {users.data.map((u) => (
                  <li key={u.id} className="px-5 py-2.5">
                    <p className="text-sm">
                      {u.full_name}
                      {u.status !== 'ativo' ? <span className="ml-1 text-xs text-muted">(inativo)</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {u.email} · {ROLE_LABEL[u.role]}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ---------------------------------------------------- histórico */}
          <Card>
            <CardHeader title="Histórico" description="Ações da administração nesta conta." />
            {!history.data?.length ? (
              <EmptyState title="Nenhuma ação registrada" />
            ) : (
              <ul className="divide-y divide-border">
                {history.data.map((h) => (
                  <li key={h.id} className="px-5 py-2.5">
                    <p className="text-sm">{ACTION_LABEL[h.action] ?? h.action}</p>
                    <p className="text-xs text-muted">
                      {formatDateTime(h.created_at)}
                      {h.actor_email ? ` · ${h.actor_email}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ----------------------------------------------- zona de perigo */}
          <Card className="border-danger/40">
            <CardHeader
              title="Excluir empresa"
              description="Apaga de vez a empresa, as manifestações, os anexos e os logins dos usuários dela. Não tem volta."
            />
            <div className="px-5 py-4">
              <DeleteCompany companyId={c.id} slug={c.slug} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

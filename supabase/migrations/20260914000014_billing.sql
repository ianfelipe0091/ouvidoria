-- Cobrança real.
--
-- Regra que organiza tudo o que vem abaixo: o estado de uma assinatura paga é
-- decidido pelo provedor de pagamento, nunca pela aplicação. O sistema não
-- marca ninguém como "pago" por conta própria — ele registra o que o provedor
-- confirmou por webhook. Sem isso, um erro de fluxo vira acesso sem pagamento
-- (ou perda de acesso depois de pagar), e os dois são difíceis de auditar
-- depois do fato.

-- Identificadores do provedor no catálogo de planos. Sem o preço cadastrado
-- lá, não há como abrir um checkout para o plano.
alter table plans
  add column provider_price_id text;

comment on column plans.provider_price_id is
  'Identificador do preço no provedor (ex.: price_... no Stripe). Nulo = plano não vendável online.';

alter table subscriptions
  add column provider                 text,
  add column provider_customer_id     text,
  add column provider_subscription_id text,
  -- Cancelamento pedido pelo cliente: o acesso continua até o fim do ciclo
  -- que já foi pago. Cortar na hora seria cobrar por um período não usado.
  add column cancel_at_period_end     boolean not null default false,
  -- Prazo de tolerância após uma falha de pagamento, antes de suspender.
  add column grace_until              timestamptz;

create unique index subscriptions_provider_subscription_idx
  on subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;

create index subscriptions_provider_customer_idx
  on subscriptions (provider_customer_id)
  where provider_customer_id is not null;

-- ------------------------------------------------------------- faturas -----
create type invoice_status as enum ('aberta', 'paga', 'falhou', 'estornada', 'cancelada');

create table invoices (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies (id) on delete cascade,

  provider             text not null,
  provider_invoice_id  text not null,

  number               text,
  status               invoice_status not null,
  amount_cents         integer not null check (amount_cents >= 0),
  currency             char(3) not null default 'BRL',

  period_start         timestamptz,
  period_end           timestamptz,
  due_at               timestamptz,
  paid_at              timestamptz,

  -- Links do próprio provedor: hospedar segunda via seria reimplementar algo
  -- que ele já faz, e com risco de divergir do documento fiscal real.
  hosted_url           text,
  pdf_url              text,

  created_at           timestamptz not null default now(),

  constraint invoices_provider_unique unique (provider, provider_invoice_id)
);

create index invoices_company_idx on invoices (company_id, created_at desc);

-- -------------------------------------------------- eventos de webhook -----
/**
 * Registro de eventos recebidos do provedor.
 *
 * Existe por um motivo específico: provedores de pagamento reenviam o mesmo
 * evento quando não recebem confirmação, e vários chegam fora de ordem.
 * A chave única em (provider, event_id) transforma reprocessamento em no-op —
 * sem ela, um reenvio de "invoice.paid" geraria fatura duplicada.
 */
create table webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  event_type   text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,

  constraint webhook_events_unique unique (provider, event_id)
);

create index webhook_events_unprocessed_idx on webhook_events (received_at)
  where processed_at is null;

-- --------------------------------------------------------------- RLS -------
alter table invoices enable row level security;
alter table webhook_events enable row level security;

grant select on invoices to authenticated;

create policy invoices_select on invoices
  for select to authenticated
  using (app.belongs_to_company(company_id));

-- webhook_events não recebe policy alguma: só o servidor, com a chave secreta,
-- escreve e lê. Não há caso de uso para o cliente ver o tráfego bruto.

/**
 * Aplica o que o provedor informou sobre uma assinatura.
 *
 * Concentra aqui a transição de estado — e a consequência dela na empresa —
 * para que exista um único lugar responsável por decidir quem tem acesso.
 * Espalhar isso pelo webhook, pelo checkout e pela tela de cobrança garantiria
 * que os três discordassem em algum caso de borda.
 */
create or replace function public.apply_subscription_state(
  p_provider_subscription_id text,
  p_status                   subscription_status,
  p_plan_price_id            text default null,
  p_period_start             timestamptz default null,
  p_period_end               timestamptz default null,
  p_cancel_at_period_end     boolean default null,
  p_grace_days               integer default 7
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription subscriptions;
  v_plan_id      uuid;
  v_company_status company_status;
begin
  -- Somente o servidor da aplicação, que é quem recebe e valida o webhook.
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Somente o servidor pode aplicar estado de assinatura'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_subscription
  from subscriptions
  where provider_subscription_id = p_provider_subscription_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'assinatura não encontrada');
  end if;

  -- Troca de plano vinda do provedor (upgrade feito no portal de cobrança).
  if p_plan_price_id is not null then
    select id into v_plan_id from plans where provider_price_id = p_plan_price_id;
  end if;

  -- Uma empresa volta a ficar ativa quando a assinatura está em dia, e é
  -- suspensa quando o pagamento falhou e a tolerância acabou.
  v_company_status := case
    when p_status in ('ativa', 'trial') then 'ativa'::company_status
    when p_status = 'cancelada' then 'suspensa'::company_status
    else null
  end;

  update subscriptions
  set status               = p_status,
      plan_id              = coalesce(v_plan_id, plan_id),
      contracted_price     = coalesce(
                               (select monthly_price from plans where id = coalesce(v_plan_id, plan_id)),
                               contracted_price),
      current_period_start = coalesce(p_period_start, current_period_start),
      current_period_end   = coalesce(p_period_end, current_period_end),
      cancel_at_period_end = coalesce(p_cancel_at_period_end, cancel_at_period_end),
      canceled_at          = case when p_status = 'cancelada' then coalesce(canceled_at, now()) else null end,
      -- A tolerância começa a contar na primeira falha e não é reiniciada por
      -- falhas seguintes do mesmo ciclo.
      grace_until          = case
                               when p_status = 'inadimplente'
                                 then coalesce(grace_until, now() + make_interval(days => p_grace_days))
                               else null
                             end,
      trial_ends_at        = case when p_status = 'trial' then trial_ends_at else null end
  where id = v_subscription.id;

  if v_company_status is not null then
    update companies set status = v_company_status where id = v_subscription.company_id;
  end if;

  return jsonb_build_object('ok', true, 'company_id', v_subscription.company_id);
end;
$$;

revoke all on function public.apply_subscription_state(text, subscription_status, text, timestamptz, timestamptz, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_state(text, subscription_status, text, timestamptz, timestamptz, boolean, integer)
  to service_role;

/**
 * Suspende quem passou da tolerância.
 *
 * Roda por agendamento: um webhook avisa da falha, mas ninguém avisa que o
 * prazo venceu — isso é passagem de tempo, não evento do provedor.
 */
create or replace function public.expire_overdue_subscriptions()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not app.is_platform_admin() then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;

  with vencidas as (
    select company_id from subscriptions
    where status = 'inadimplente' and grace_until is not null and grace_until < now()
  )
  update companies set status = 'suspensa'
  where id in (select company_id from vencidas) and status = 'ativa';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.expire_overdue_subscriptions() to service_role, authenticated;

/**
 * Situação de cobrança que a aplicação consulta para decidir o acesso.
 * Deriva tudo de uma vez, para que interface e servidor não cheguem a
 * conclusões diferentes sobre a mesma assinatura.
 */
create or replace function public.billing_state(p_company_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'status', s.status,
    'plan', p.name,
    'plan_slug', p.slug,
    'price', s.contracted_price,
    'trial_ends_at', s.trial_ends_at,
    'current_period_end', s.current_period_end,
    'cancel_at_period_end', s.cancel_at_period_end,
    'grace_until', s.grace_until,
    'has_payment_method', s.provider_subscription_id is not null,
    'company_status', c.status,
    -- Bloqueio efetivo: avaliação vencida sem assinatura, inadimplência fora
    -- da tolerância, ou cancelamento já em vigor.
    'blocked', (
      (s.status = 'trial' and s.trial_ends_at is not null and s.trial_ends_at < now())
      or (s.status = 'inadimplente' and s.grace_until is not null and s.grace_until < now())
      or (s.status = 'cancelada' and (s.current_period_end is null or s.current_period_end < now()))
    )
  )
  from subscriptions s
  join plans p on p.id = s.plan_id
  join companies c on c.id = s.company_id
  where s.company_id = p_company_id;
$$;

grant execute on function public.billing_state(uuid) to authenticated;

-- Camada comercial: planos, assinaturas, limites e onboarding.
--
-- O plano de uma empresa passa a viver exclusivamente em `subscriptions`.
-- `companies.plan_id` sai: manter o plano em dois lugares garante que um dia
-- eles discordem, e aí não há como saber qual vale para cobrar ou limitar.

create type subscription_status as enum (
  'trial',        -- período de avaliação, sem cobrança
  'ativa',
  'inadimplente', -- pagamento em atraso; o ambiente segue acessível
  'cancelada'     -- encerrada; o ambiente fica somente leitura
);

-- ------------------------------------------------------------- planos ------
alter table plans
  add column description  text,
  add column features     jsonb not null default '[]'::jsonb,
  add column trial_days   integer not null default 14 check (trial_days >= 0),
  add column is_public    boolean not null default true,
  add column sort_order   integer not null default 0;

-- Preço deixa de ser opcional: um plano comercial sem preço não é ofertável.
-- 0 representa o gratuito.
update plans set monthly_price = coalesce(monthly_price, 0);
alter table plans alter column monthly_price set not null;
alter table plans alter column monthly_price set default 0;

update plans set
  description = case slug
    when 'basic'        then 'Para quem está começando a estruturar a ouvidoria.'
    when 'professional' then 'Para operações com várias unidades e equipe dedicada.'
    when 'enterprise'   then 'Para grupos com muitas unidades e exigências próprias.'
  end,
  -- Limites de filiais e usuários NÃO entram aqui: a tabela de planos já os
  -- renderiza a partir de max_branches/max_users. Repetir gera linha duplicada.
  features = case slug
    when 'basic' then '["Canal público personalizado","Manifestações ilimitadas","Anexos e histórico completo","Relatórios básicos"]'::jsonb
    when 'professional' then '["Tudo do Basic","Departamentos e encaminhamento","Painel de indicadores por filial","Exportação de relatórios"]'::jsonb
    when 'enterprise' then '["Tudo do Professional","Suporte prioritário","Retenção estendida de auditoria","Integrações sob demanda"]'::jsonb
  end,
  monthly_price = case slug
    when 'basic' then 149 when 'professional' then 399 when 'enterprise' then 899
  end,
  sort_order = case slug when 'basic' then 1 when 'professional' then 2 else 3 end;

-- --------------------------------------------------------- assinaturas -----
create table subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  -- Uma assinatura por empresa: o modelo é uma conta, um ambiente, um plano.
  company_id           uuid not null unique references companies (id) on delete cascade,
  plan_id              uuid not null references plans (id),

  status               subscription_status not null default 'trial',
  trial_ends_at        timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz,
  canceled_at          timestamptz,

  -- Guarda o preço vigente na contratação. O preço do plano pode mudar; o que
  -- foi combinado com esta empresa, não.
  contracted_price     numeric(10, 2) not null default 0,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint subscriptions_canceled_consistency check (
    (status = 'cancelada') = (canceled_at is not null)
  )
);

create index subscriptions_status_idx on subscriptions (status);
create index subscriptions_plan_idx on subscriptions (plan_id);

create trigger subscriptions_touch before update on subscriptions
  for each row execute function app.touch_updated_at();

-- Migra o plano atual de cada empresa para uma assinatura em avaliação.
insert into subscriptions (company_id, plan_id, status, trial_ends_at, contracted_price)
select c.id,
       coalesce(c.plan_id, (select id from plans where slug = 'basic')),
       'trial',
       now() + interval '14 days',
       coalesce((select monthly_price from plans p where p.id = c.plan_id), 0)
from companies c
on conflict (company_id) do nothing;

alter table companies drop column plan_id;

-- --------------------------------------------------------- onboarding ------
-- Null enquanto a empresa não concluiu a configuração inicial. É o que faz o
-- painel desviar para o assistente na primeira entrada.
alter table companies add column onboarded_at timestamptz;

-- Empresas que já existiam nasceram antes do assistente; não faz sentido
-- mandá-las configurar algo que já está configurado.
update companies set onboarded_at = created_at;

-- ------------------------------------------------- limites do plano --------
-- Uso atual da empresa, para a tela de plano e para a checagem de limites.
create or replace function public.company_usage(p_company_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'branches', (select count(*) from branches where company_id = p_company_id and status = 'ativo'),
    'users',    (select count(*) from profiles where company_id = p_company_id and status = 'ativo'),
    'occurrences_month', (
      select count(*) from occurrences
      where company_id = p_company_id and opened_at >= date_trunc('month', now())
    )
  );
$$;

grant execute on function public.company_usage(uuid) to authenticated;

/**
 * Impede ultrapassar os limites do plano.
 *
 * Vive no banco, e não na interface, porque a interface é só um dos caminhos
 * de escrita: a API do PostgREST e qualquer Server Action chegam à tabela do
 * mesmo jeito. Um limite que só existe no formulário não é um limite.
 */
create or replace function app.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
  v_used  integer;
  v_label text;
begin
  if tg_table_name = 'branches' then
    select p.max_branches into v_limit
    from subscriptions s join plans p on p.id = s.plan_id
    where s.company_id = new.company_id;

    if v_limit is null then return new; end if;  -- ilimitado

    select count(*) into v_used
    from branches where company_id = new.company_id and status = 'ativo';
    v_label := 'filiais';

  elsif tg_table_name = 'profiles' then
    -- O administrador da plataforma não pertence a empresa alguma.
    if new.company_id is null then return new; end if;

    select p.max_users into v_limit
    from subscriptions s join plans p on p.id = s.plan_id
    where s.company_id = new.company_id;

    if v_limit is null then return new; end if;

    select count(*) into v_used
    from profiles where company_id = new.company_id and status = 'ativo';
    v_label := 'usuários';
  else
    return new;
  end if;

  if v_used >= v_limit then
    raise exception 'O plano atual permite até % %. Faça upgrade para adicionar mais.',
      v_limit, v_label
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger branches_plan_limit
  before insert on branches
  for each row execute function app.enforce_plan_limits();

create trigger profiles_plan_limit
  before insert on profiles
  for each row execute function app.enforce_plan_limits();

-- --------------------------------------------------------------- RLS -------
alter table subscriptions enable row level security;

grant select on subscriptions to authenticated;

create policy subscriptions_select on subscriptions
  for select to authenticated
  using (app.belongs_to_company(company_id));

-- Trocar de plano é operação comercial: passa por função dedicada, nunca por
-- update direto na tabela. Sem policy de insert/update/delete, portanto.

-- Planos ficam visíveis também ao canal público, para a página de preços.
grant select on plans to anon;

create policy plans_select_public on plans
  for select to anon
  using (is_active and is_public);

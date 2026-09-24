-- Nova grade de planos e plano negociado com o comercial.
--
-- Limites de filiais passam a 1 / 10 / 100, e entra um quarto plano, de até
-- 1.000 filiais, com valor personalizado: não se contrata pelo site, e sim
-- falando com um especialista.
--
-- Os limites valem para NOVAS filiais: o gatilho enforce_plan_limits barra a
-- inclusão acima do teto, mas não desativa o que já existe. Empresa que já
-- passou do novo limite fica como está e só não consegue adicionar mais.

-- ------------------------------------------------ contratação self-service ---
-- Distingue o plano que o cliente contrata sozinho (cadastro, troca no painel)
-- do plano negociado com a equipe comercial. O preço de um plano negociado é
-- acertado caso a caso; o monthly_price dele (0) não é "gratuito" e não deve
-- ser exibido — a interface mostra "valor personalizado".
alter table plans
  add column self_service boolean not null default true;

comment on column plans.self_service is
  'false = plano negociado com o comercial: não pode ser escolhido no cadastro nem na troca de plano pelo cliente; só o administrador da plataforma o atribui.';

-- ------------------------------------------------------------ nova grade ---
update plans set max_branches = 1   where slug = 'basic';
update plans set max_branches = 10  where slug = 'professional';
update plans set max_branches = 100 where slug = 'enterprise';

insert into plans (
  slug, name, description, max_branches, max_users, monthly_price,
  features, trial_days, is_public, is_active, sort_order, self_service
) values (
  'enterprise-plus',
  'Enterprise Plus',
  'Para redes e grupos com operação de grande porte.',
  1000,
  null,
  0,
  '["Tudo do Enterprise","Contratação com um especialista"]'::jsonb,
  0,
  true,
  true,
  4,
  false
)
on conflict (slug) do nothing;

-- ------------------------------------- travas nas portas de autoatendimento ---
-- As duas funções abaixo são as de 20260914000013, idênticas exceto pela trava
-- de plano negociado logo após a leitura do plano.

create or replace function public.provision_company(
  p_slug            text,
  p_legal_name      text,
  p_tax_id          text,
  p_email           text,
  p_trade_name      text default null,
  p_plan_slug       text default 'basic',
  p_admin_user_id   uuid default null,
  p_admin_name      text default null,
  p_admin_email     text default null,
  p_headquarters    text default 'Matriz',
  p_phone           text default null,
  p_contact_name    text default null,
  p_contact_phone   text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id  uuid;
  v_plan        plans;
  v_category_id uuid;
  v_type        record;
  v_cat         record;
begin
  -- Chamada pelo cadastro público (service_role, pelo servidor da aplicação)
  -- ou pelo administrador da plataforma.
  if not (app.is_platform_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'Cadastro de empresa exige o servidor da aplicação'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_plan from plans where slug = p_plan_slug and is_active;
  if not found then
    raise exception 'Plano % não encontrado', p_plan_slug using errcode = 'no_data_found';
  end if;

  -- Plano negociado não entra pelo cadastro público: sem esta trava, trocar o
  -- ?plano= da URL daria avaliação grátis do maior plano. Só o administrador
  -- da plataforma provisiona empresa num plano assim.
  if not v_plan.self_service and not app.is_platform_admin() then
    raise exception 'O plano % é contratado com a equipe comercial', v_plan.name
      using errcode = 'insufficient_privilege';
  end if;

  insert into companies (
    slug, legal_name, trade_name, tax_id, email, phone,
    contact_name, contact_email, contact_phone
  )
  values (
    p_slug, p_legal_name, p_trade_name, p_tax_id, p_email, p_phone,
    coalesce(p_contact_name, p_admin_name), coalesce(p_admin_email, p_email), p_contact_phone
  )
  returning id into v_company_id;

  -- A assinatura vem antes de filiais e usuários: é ela que define os limites
  -- que o gatilho confere nos inserts seguintes.
  insert into subscriptions (
    company_id, plan_id, status, trial_ends_at, current_period_end, contracted_price
  )
  values (
    v_company_id, v_plan.id, 'trial',
    now() + make_interval(days => v_plan.trial_days),
    now() + make_interval(days => v_plan.trial_days),
    v_plan.monthly_price
  );

  insert into company_settings (company_id, channel_name, notification_email)
  values (v_company_id, coalesce(p_trade_name, p_legal_name), p_email);

  insert into branches (company_id, name, tax_id, is_headquarters)
  values (v_company_id, p_headquarters, p_tax_id, true);

  for v_type in
    select * from (values
      ('Reclamação', 'reclamacao', 1), ('Denúncia', 'denuncia', 2),
      ('Elogio', 'elogio', 3),         ('Sugestão', 'sugestao', 4),
      ('Solicitação','solicitacao',5), ('Dúvida', 'duvida', 6),
      ('Crítica', 'critica', 7),       ('Outros', 'outros', 8)
    ) as t(name, slug, sort_order)
  loop
    insert into occurrence_types (company_id, name, slug, is_system, sort_order)
    values (v_company_id, v_type.name, v_type.slug, true, v_type.sort_order);
  end loop;

  for v_cat in
    select * from (values
      ('Recursos Humanos', 1, array['Assédio', 'Benefícios', 'Condições de trabalho', 'Remuneração', 'Relacionamento']),
      ('Atendimento',      2, array['Qualidade do atendimento', 'Prazo', 'Comportamento', 'Informação']),
      ('Operação',         3, array['Produto', 'Serviço', 'Segurança', 'Manutenção'])
    ) as c(name, sort_order, subjects)
  loop
    insert into categories (company_id, name, sort_order)
    values (v_company_id, v_cat.name, v_cat.sort_order)
    returning id into v_category_id;

    insert into subjects (company_id, category_id, name, sort_order)
    select v_company_id, v_category_id, s.name, s.ord
    from unnest(v_cat.subjects) with ordinality as s(name, ord);
  end loop;

  if p_admin_user_id is not null then
    insert into profiles (id, company_id, full_name, email, role, phone)
    values (
      p_admin_user_id, v_company_id,
      coalesce(p_admin_name, p_legal_name),
      coalesce(p_admin_email, p_email),
      'company_admin', p_contact_phone
    );
  end if;

  return v_company_id;
end;
$$;

create or replace function public.change_company_plan(
  p_company_id uuid,
  p_plan_slug  text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan  plans;
  v_usage jsonb;
begin
  if not app.administers_company(p_company_id) then
    raise exception 'Somente o administrador da empresa pode alterar o plano'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_plan from plans where slug = p_plan_slug and is_active;
  if not found then
    raise exception 'Plano não encontrado' using errcode = 'no_data_found';
  end if;

  -- Idem na troca de plano: o cliente não passa sozinho para um plano
  -- negociado. O painel da plataforma, sim — é por ele que o comercial ativa
  -- o contrato fechado.
  if not v_plan.self_service and not app.is_platform_admin() then
    raise exception 'O plano % é contratado com a equipe comercial', v_plan.name
      using errcode = 'insufficient_privilege';
  end if;

  -- Descer de plano com uso acima do novo limite deixaria a empresa em estado
  -- inconsistente: filiais existentes que o plano não comporta.
  v_usage := public.company_usage(p_company_id);

  if v_plan.max_branches is not null and (v_usage ->> 'branches')::integer > v_plan.max_branches then
    raise exception 'A empresa tem % filiais ativas e o plano % permite %. Desative filiais antes de trocar.',
      v_usage ->> 'branches', v_plan.name, v_plan.max_branches
      using errcode = 'check_violation';
  end if;

  if v_plan.max_users is not null and (v_usage ->> 'users')::integer > v_plan.max_users then
    raise exception 'A empresa tem % usuários ativos e o plano % permite %. Desative usuários antes de trocar.',
      v_usage ->> 'users', v_plan.name, v_plan.max_users
      using errcode = 'check_violation';
  end if;

  update subscriptions
  set plan_id = v_plan.id,
      contracted_price = v_plan.monthly_price,
      -- Assinar um plano encerra a avaliação.
      status = case when status = 'trial' then 'ativa'::subscription_status else status end,
      trial_ends_at = case when status = 'trial' then null else trial_ends_at end,
      current_period_start = now(),
      current_period_end = now() + interval '30 days'
  where company_id = p_company_id;

  return jsonb_build_object('ok', true, 'plan', v_plan.name);
end;
$$;


-- ------------------------------------------------ mensagem do limite -------
-- Com o Basic em 1 filial, a mensagem antiga saía "permite até 1 filiais".
-- Mesma função de 20260914000012, só com o rótulo no singular quando o
-- limite é 1 e a nomenclatura "filiais ou empresas" dos planos.
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
    v_label := case when v_limit = 1 then 'filial ou empresa' else 'filiais ou empresas' end;

  elsif tg_table_name = 'profiles' then
    -- O administrador da plataforma não pertence a empresa alguma.
    if new.company_id is null then return new; end if;

    select p.max_users into v_limit
    from subscriptions s join plans p on p.id = s.plan_id
    where s.company_id = new.company_id;

    if v_limit is null then return new; end if;

    select count(*) into v_used
    from profiles where company_id = new.company_id and status = 'ativo';
    v_label := case when v_limit = 1 then 'usuário' else 'usuários' end;
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

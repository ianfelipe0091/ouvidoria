-- Provisionamento no modelo comercial: cadastro self-service, assinatura
-- automática e operações de plano.

-- Remove acentos sem depender da extensão unaccent, que não está instalada.
create or replace function public.unaccent_fallback(p_text text)
returns text
language sql
immutable
as $$
  select translate(
    p_text,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

-- Slug livre a partir do nome da empresa. Sufixa com número quando já existe,
-- porque duas empresas podem legitimamente ter nomes parecidos.
create or replace function public.suggest_company_slug(p_name text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_base    text;
  v_slug    text;
  v_counter integer := 1;
begin
  v_base := lower(unaccent_fallback(p_name));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  v_base := left(v_base, 40);

  if v_base = '' then v_base := 'empresa'; end if;

  v_slug := v_base;
  while exists (select 1 from companies where slug = v_slug) loop
    v_counter := v_counter + 1;
    v_slug := v_base || '-' || v_counter::text;
  end loop;

  return v_slug;
end;
$$;

drop function if exists public.provision_company(text, text, text, text, text, text, uuid, text, text, text);

/**
 * Cria o ambiente completo de uma empresa cliente.
 *
 * Tudo numa transação: empresa, assinatura em avaliação, configurações,
 * matriz e taxonomia padrão. Uma empresa pela metade — com cadastro mas sem
 * plano, ou sem os tipos de manifestação — não teria como operar.
 */
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

revoke all on function public.provision_company(text, text, text, text, text, text, uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.provision_company(text, text, text, text, text, text, uuid, text, text, text, text, text, text) to authenticated, service_role;

/**
 * Troca o plano da empresa.
 *
 * Sem cobrança real: a troca é imediata. Quando entrar um meio de pagamento,
 * o upgrade passa a ser consequência do pagamento confirmado, e esta função
 * deixa de ser chamável pelo próprio cliente.
 */
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

grant execute on function public.change_company_plan(uuid, text) to authenticated;

/** Marca o fim do assistente de configuração inicial. */
create or replace function public.complete_onboarding(p_company_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.administers_company(p_company_id) then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;

  update companies set onboarded_at = now()
  where id = p_company_id and onboarded_at is null;
end;
$$;

grant execute on function public.complete_onboarding(uuid) to authenticated;

/**
 * Situação da empresa e da assinatura, no painel da plataforma.
 * Exclusiva do dono da plataforma — mexe em qualquer tenant.
 */
create or replace function public.set_company_status(
  p_company_id uuid,
  p_status     company_status,
  p_subscription_status subscription_status default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'Somente a administradora da plataforma' using errcode = 'insufficient_privilege';
  end if;

  update companies set status = p_status where id = p_company_id;

  if p_subscription_status is not null then
    update subscriptions
    set status = p_subscription_status,
        canceled_at = case when p_subscription_status = 'cancelada' then now() else null end
    where company_id = p_company_id;
  end if;
end;
$$;

grant execute on function public.set_company_status(uuid, company_status, subscription_status) to authenticated;

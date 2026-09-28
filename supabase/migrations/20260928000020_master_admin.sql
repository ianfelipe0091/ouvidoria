-- Painel Master: controle das empresas clientes e da cobrança manual.
--
-- A cobrança hoje é manual (sem preços no provedor de pagamento): quem confirma
-- o pagamento é o administrador da plataforma. Esta migração dá a ele as
-- ferramentas para isso e fecha duas brechas que tornavam o bloqueio inócuo.
--
-- Todas as ações novas são funções SECURITY DEFINER que conferem o papel de
-- administrador da plataforma e deixam registro em audit_logs com ação
-- "admin.*" — assinaturas e faturas não têm política de escrita, de propósito.

-- ------------------------------------------------------------- faturas -----
-- Pagamento registrado à mão precisa dizer como foi pago e por quem foi lançado.
alter table invoices
  add column method      text,
  add column note        text,
  add column recorded_by uuid;

comment on column invoices.method is 'Forma de pagamento de lançamento manual: pix, boleto, transferencia, cartao, dinheiro, outro.';
comment on column invoices.recorded_by is 'Administrador da plataforma que lançou o pagamento manual.';

-- ----------------------------------------------------- registro de ações ---
create or replace function app.log_admin_action(
  p_company_id uuid,
  p_action     text,
  p_changes    jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into audit_logs (company_id, actor_id, actor_email, action, entity, entity_id, changes)
  values (p_company_id, auth.uid(), auth.jwt() ->> 'email', p_action, 'companies',
          p_company_id::text, coalesce(p_changes, '{}'::jsonb));
$$;

-- ------------------------------------------ brecha 1: suspensão não bloqueava ---
-- O botão "Suspender" mudava companies.status, mas o bloqueio do painel olhava
-- só a assinatura: a empresa suspensa seguia usando o painel normalmente.
-- Agora a situação da empresa também bloqueia.
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
    'blocked', (
      c.status in ('suspensa', 'bloqueada', 'cancelada')
      or (s.status = 'trial' and s.trial_ends_at is not null and s.trial_ends_at < now())
      or (s.status = 'inadimplente' and s.grace_until is not null and s.grace_until < now())
      or (s.status = 'cancelada' and (s.current_period_end is null or s.current_period_end < now()))
    )
  )
  from subscriptions s
  join plans p on p.id = s.plan_id
  join companies c on c.id = s.company_id
  where s.company_id = p_company_id;
$$;

-- ------------------------- brecha 2: trocar de plano desbloqueava sem pagar ---
-- Sem provedor de pagamento, trocar de plano tirava a assinatura da avaliação
-- e abria 30 dias pagos — um cliente com avaliação vencida se desbloqueava
-- sozinho clicando em "Mudar para Basic". Trocar de plano agora só troca o
-- plano; ativar e estender a assinatura é registrar pagamento
-- (admin_register_payment) ou o webhook do provedor.
-- Mesmo corpo de 20260924000017, sem o bloco que mexia em status e período.
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

  if not v_plan.self_service and not app.is_platform_admin() then
    raise exception 'O plano % é contratado com a equipe comercial', v_plan.name
      using errcode = 'insufficient_privilege';
  end if;

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
      contracted_price = v_plan.monthly_price
  where company_id = p_company_id;

  if app.is_platform_admin() then
    perform app.log_admin_action(p_company_id, 'admin.trocar_plano', jsonb_build_object('plano', v_plan.slug));
  end if;

  return jsonb_build_object('ok', true, 'plan', v_plan.name);
end;
$$;

-- -------------------------------------------------- situação da empresa ---
-- Mesmo contrato de antes, agora com registro da ação.
create or replace function public.set_company_status(
  p_company_id uuid,
  p_status company_status,
  p_subscription_status subscription_status default null
)
returns void
language plpgsql
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
        canceled_at = case when p_subscription_status = 'cancelada' then now() else null end,
        -- Reativar limpa a tolerância; sem isso, uma inadimplência antiga
        -- continuaria bloqueando depois da reativação.
        grace_until = case when p_subscription_status = 'ativa' then null else grace_until end
    where company_id = p_company_id;
  end if;

  perform app.log_admin_action(p_company_id, 'admin.situacao',
    jsonb_build_object('empresa', p_status, 'assinatura', p_subscription_status));
end;
$$;

-- ---------------------------------------------------- dados cadastrais ---
-- Recebe só os campos editáveis; o que não vier no JSON fica como está.
-- O apelido (slug) não é editável aqui: ele é o endereço público do canal, e
-- trocá-lo quebraria links e QR codes já distribuídos.
create or replace function public.admin_update_company(p_company_id uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_diff   jsonb := '{}'::jsonb;
  v_key    text;
begin
  if not app.is_platform_admin() then
    raise exception 'Somente a administradora da plataforma' using errcode = 'insufficient_privilege';
  end if;

  select to_jsonb(c) into v_before from companies c where id = p_company_id;
  if v_before is null then
    raise exception 'Empresa não encontrada' using errcode = 'no_data_found';
  end if;

  update companies set
    legal_name         = coalesce(nullif(p_data ->> 'legal_name', ''), legal_name),
    trade_name         = case when p_data ? 'trade_name' then nullif(p_data ->> 'trade_name', '') else trade_name end,
    tax_id             = coalesce(nullif(p_data ->> 'tax_id', ''), tax_id),
    email              = coalesce(nullif(p_data ->> 'email', ''), email),
    phone              = case when p_data ? 'phone' then nullif(p_data ->> 'phone', '') else phone end,
    whatsapp           = case when p_data ? 'whatsapp' then nullif(p_data ->> 'whatsapp', '') else whatsapp end,
    website            = case when p_data ? 'website' then nullif(p_data ->> 'website', '') else website end,
    contact_name       = case when p_data ? 'contact_name' then nullif(p_data ->> 'contact_name', '') else contact_name end,
    contact_email      = case when p_data ? 'contact_email' then nullif(p_data ->> 'contact_email', '') else contact_email end,
    contact_phone      = case when p_data ? 'contact_phone' then nullif(p_data ->> 'contact_phone', '') else contact_phone end,
    address_street     = case when p_data ? 'address_street' then nullif(p_data ->> 'address_street', '') else address_street end,
    address_number     = case when p_data ? 'address_number' then nullif(p_data ->> 'address_number', '') else address_number end,
    address_complement = case when p_data ? 'address_complement' then nullif(p_data ->> 'address_complement', '') else address_complement end,
    address_district   = case when p_data ? 'address_district' then nullif(p_data ->> 'address_district', '') else address_district end,
    address_city       = case when p_data ? 'address_city' then nullif(p_data ->> 'address_city', '') else address_city end,
    address_state      = case when p_data ? 'address_state' then nullif(upper(p_data ->> 'address_state'), '') else address_state end,
    address_zip        = case when p_data ? 'address_zip' then nullif(p_data ->> 'address_zip', '') else address_zip end
  where id = p_company_id;

  select to_jsonb(c) into v_after from companies c where id = p_company_id;

  -- Guarda só o que mudou, com antes e depois.
  for v_key in select jsonb_object_keys(v_after) loop
    if v_key not in ('updated_at') and v_after -> v_key is distinct from v_before -> v_key then
      v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('de', v_before -> v_key, 'para', v_after -> v_key));
    end if;
  end loop;

  if v_diff <> '{}'::jsonb then
    perform app.log_admin_action(p_company_id, 'admin.editar_empresa', v_diff);
  end if;
end;
$$;

-- -------------------------------------------------- dados da assinatura ---
-- Ajuste direto: valor contratado (plano negociado), vencimento ("pago até"),
-- fim da avaliação e tolerância. Nulo em p_grace_until limpa a tolerância.
create or replace function public.admin_update_billing(
  p_company_id         uuid,
  p_contracted_price   numeric,
  p_current_period_end timestamptz,
  p_trial_ends_at      timestamptz,
  p_grace_until        timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
begin
  if not app.is_platform_admin() then
    raise exception 'Somente a administradora da plataforma' using errcode = 'insufficient_privilege';
  end if;
  if p_contracted_price is null or p_contracted_price < 0 then
    raise exception 'Valor contratado inválido' using errcode = 'check_violation';
  end if;

  select jsonb_build_object('valor', contracted_price, 'pago_ate', current_period_end,
                            'fim_avaliacao', trial_ends_at, 'tolerancia', grace_until)
    into v_before
  from subscriptions where company_id = p_company_id;

  update subscriptions set
    contracted_price   = p_contracted_price,
    current_period_end = p_current_period_end,
    trial_ends_at      = p_trial_ends_at,
    grace_until        = p_grace_until
  where company_id = p_company_id;

  perform app.log_admin_action(p_company_id, 'admin.editar_cobranca', jsonb_build_object(
    'antes', v_before,
    'depois', jsonb_build_object('valor', p_contracted_price, 'pago_ate', p_current_period_end,
                                 'fim_avaliacao', p_trial_ends_at, 'tolerancia', p_grace_until)));
end;
$$;

-- ------------------------------------------------ registrar pagamento ---
-- Lança uma fatura paga e estende o período pago. Se ainda há período pago no
-- futuro, a extensão parte do fim dele (quem paga adiantado não perde dias),
-- qualquer que seja a situação da assinatura; senão, parte da data do pagamento. Tira a assinatura da avaliação ou da
-- inadimplência, e reativa empresa suspensa — suspensão é por falta de
-- pagamento. Bloqueio manual ("bloqueada") não é desfeito aqui: tem outro
-- motivo e se desfaz explicitamente.
create or replace function public.admin_register_payment(
  p_company_id uuid,
  p_amount     numeric,
  p_months     integer,
  p_method     text,
  p_paid_at    timestamptz,
  p_note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub    subscriptions;
  v_start  timestamptz;
  v_end    timestamptz;
  v_number text;
  v_id     uuid;
  v_paid   timestamptz := coalesce(p_paid_at, now());
begin
  if not app.is_platform_admin() then
    raise exception 'Somente a administradora da plataforma' using errcode = 'insufficient_privilege';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Valor do pagamento inválido' using errcode = 'check_violation';
  end if;
  if p_months is null or p_months < 1 or p_months > 36 then
    raise exception 'Informe de 1 a 36 meses' using errcode = 'check_violation';
  end if;

  select * into v_sub from subscriptions where company_id = p_company_id for update;
  if not found then
    raise exception 'Empresa sem assinatura' using errcode = 'no_data_found';
  end if;

  -- Dias já pagos nunca se perdem: nem marcar inadimplente por engano nem
  -- suspender apagam o que o cliente pagou adiantado.
  v_start := case
    when v_sub.current_period_end > v_paid then v_sub.current_period_end
    else v_paid
  end;
  v_end := v_start + make_interval(months => p_months);

  v_number := 'MAN-' || to_char(v_paid, 'YYYYMM') || '-' ||
    lpad((select count(*) + 1 from invoices where provider = 'manual')::text, 4, '0');

  insert into invoices (
    company_id, provider, provider_invoice_id, number, status, amount_cents,
    period_start, period_end, due_at, paid_at, method, note, recorded_by
  ) values (
    p_company_id, 'manual', gen_random_uuid()::text, v_number, 'paga', round(p_amount * 100)::integer,
    v_start, v_end, v_start, v_paid, nullif(p_method, ''), nullif(p_note, ''), auth.uid()
  )
  returning id into v_id;

  update subscriptions set
    status               = 'ativa',
    trial_ends_at        = null,
    grace_until          = null,
    canceled_at          = null,
    current_period_start = v_start,
    current_period_end   = v_end
  where company_id = p_company_id;

  update companies set status = 'ativa' where id = p_company_id and status = 'suspensa';

  perform app.log_admin_action(p_company_id, 'admin.registrar_pagamento', jsonb_build_object(
    'fatura', v_number, 'valor', p_amount, 'meses', p_months, 'forma', p_method, 'pago_ate', v_end));

  return jsonb_build_object('invoice_id', v_id, 'number', v_number, 'period_end', v_end);
end;
$$;

-- ---------------------------------------------- marcar inadimplente ---
-- Abre a tolerância: durante ela o cliente segue usando; vencida, o painel
-- bloqueia sozinho (billing_state). Zero dias bloqueia na hora.
create or replace function public.admin_mark_overdue(p_company_id uuid, p_grace_days integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'Somente a administradora da plataforma' using errcode = 'insufficient_privilege';
  end if;
  if p_grace_days is null or p_grace_days < 0 or p_grace_days > 90 then
    raise exception 'Tolerância deve ser de 0 a 90 dias' using errcode = 'check_violation';
  end if;

  update subscriptions set
    status      = 'inadimplente',
    grace_until = now() + make_interval(days => p_grace_days)
  where company_id = p_company_id;

  perform app.log_admin_action(p_company_id, 'admin.inadimplente',
    jsonb_build_object('tolerancia_dias', p_grace_days));
end;
$$;

-- ---------------------------------------------------- excluir empresa ---
-- Irreversível. Exige o apelido da empresa como confirmação, apaga a empresa
-- (tudo do tenant cai em cascata) e as contas de login dos usuários dela.
-- O registro da exclusão fica em audit_logs, que não tem chave estrangeira
-- para companies justamente para sobreviver a isto. Os arquivos anexos são
-- removidos do storage pela aplicação, que tem acesso à API de storage.
create or replace function public.admin_delete_company(p_company_id uuid, p_confirm_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company companies;
  v_users   uuid[];
begin
  if not app.is_platform_admin() then
    raise exception 'Somente a administradora da plataforma' using errcode = 'insufficient_privilege';
  end if;

  select * into v_company from companies where id = p_company_id;
  if not found then
    raise exception 'Empresa não encontrada' using errcode = 'no_data_found';
  end if;
  if p_confirm_slug is distinct from v_company.slug then
    raise exception 'Confirmação não confere com o endereço da empresa' using errcode = 'check_violation';
  end if;

  -- Só usuários da empresa: o administrador da plataforma não tem company_id.
  select coalesce(array_agg(id), '{}') into v_users
  from profiles where company_id = p_company_id and role <> 'platform_admin';

  perform app.log_admin_action(p_company_id, 'admin.excluir_empresa', jsonb_build_object(
    'empresa', jsonb_build_object('slug', v_company.slug, 'razao_social', v_company.legal_name,
                                  'cnpj', v_company.tax_id, 'email', v_company.email),
    'usuarios_removidos', coalesce(array_length(v_users, 1), 0)));

  delete from companies where id = p_company_id;
  delete from auth.users where id = any(v_users);

  return jsonb_build_object('ok', true, 'usuarios_removidos', coalesce(array_length(v_users, 1), 0));
end;
$$;

grant execute on function public.admin_update_company(uuid, jsonb) to authenticated;
grant execute on function public.admin_update_billing(uuid, numeric, timestamptz, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_register_payment(uuid, numeric, integer, text, timestamptz, text) to authenticated;
grant execute on function public.admin_mark_overdue(uuid, integer) to authenticated;
grant execute on function public.admin_delete_company(uuid, text) to authenticated;

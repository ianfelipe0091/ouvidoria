-- Provisionamento de uma empresa cliente e catálogo de planos.

insert into plans (slug, name, max_branches, max_users, monthly_price) values
  ('basic',        'Basic',         3,    5,    null),
  ('professional', 'Professional',  20,   null, null),
  ('enterprise',   'Enterprise',    null, null, null);

-- Cria a empresa já utilizável: configurações, matriz e taxonomia padrão.
-- Tudo numa transação — uma empresa pela metade não deve existir.
create or replace function public.provision_company(
  p_slug            text,
  p_legal_name      text,
  p_tax_id          text,
  p_email           text,
  p_trade_name      text default null,
  p_plan_slug       text default 'basic',
  p_admin_user_id   uuid default null,   -- id já criado no Supabase Auth
  p_admin_name      text default null,
  p_admin_email     text default null,
  p_headquarters    text default 'Matriz'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id  uuid;
  v_category_id uuid;
  v_type        record;
  v_cat         record;
begin
  if not (app.is_platform_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'Apenas a administradora da plataforma pode cadastrar empresas'
      using errcode = 'insufficient_privilege';
  end if;

  insert into companies (slug, legal_name, trade_name, tax_id, email, plan_id)
  values (
    p_slug, p_legal_name, p_trade_name, p_tax_id, p_email,
    (select id from plans where slug = p_plan_slug)
  )
  returning id into v_company_id;

  insert into company_settings (company_id, channel_name, notification_email)
  values (v_company_id, coalesce(p_trade_name, p_legal_name), p_email);

  insert into branches (company_id, name, tax_id, is_headquarters)
  values (v_company_id, p_headquarters, p_tax_id, true);

  -- Tipos padrão. A empresa pode desativá-los e criar os seus.
  for v_type in
    select * from (values
      ('Reclamação', 'reclamacao', 1),
      ('Denúncia',   'denuncia',   2),
      ('Elogio',     'elogio',     3),
      ('Sugestão',   'sugestao',   4),
      ('Solicitação','solicitacao',5),
      ('Dúvida',     'duvida',     6),
      ('Crítica',    'critica',    7),
      ('Outros',     'outros',     8)
    ) as t(name, slug, sort_order)
  loop
    insert into occurrence_types (company_id, name, slug, is_system, sort_order)
    values (v_company_id, v_type.name, v_type.slug, true, v_type.sort_order);
  end loop;

  -- Categorias e assuntos padrão.
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

  -- Administrador da empresa, quando o usuário do Auth já existe.
  if p_admin_user_id is not null then
    insert into profiles (id, company_id, full_name, email, role)
    values (
      p_admin_user_id,
      v_company_id,
      coalesce(p_admin_name, p_legal_name),
      coalesce(p_admin_email, p_email),
      'company_admin'
    );
  end if;

  return v_company_id;
end;
$$;

revoke all on function public.provision_company(text, text, text, text, text, text, uuid, text, text, text) from public, anon;
grant execute on function public.provision_company(text, text, text, text, text, text, uuid, text, text, text) to authenticated, service_role;

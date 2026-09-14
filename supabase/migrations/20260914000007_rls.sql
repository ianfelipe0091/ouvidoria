-- Row Level Security.
--
-- Postura adotada:
--   * `anon` (canal público) NÃO recebe acesso direto a nenhuma tabela. Tudo o
--     que o manifestante faz passa por funções SECURITY DEFINER, que validam
--     protocolo e código de acompanhamento antes de tocar em qualquer dado.
--   * `authenticated` enxerga estritamente o seu tenant, decidido pelas funções
--     do schema `app`.
--   * `service_role` (chave secreta) ignora RLS por definição do Postgres.

-- Acesso a uma ocorrência a partir do seu id. Usada pelas tabelas filhas, que
-- não carregam filial/departamento/responsável para repetir a regra.
create or replace function app.can_access_occurrence_id(target_occurrence_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from occurrences o
    where o.id = target_occurrence_id
      and app.can_access_occurrence(o.company_id, o.branch_id, o.department_id, o.assignee_id)
  );
$$;

revoke all on function app.can_access_occurrence_id(uuid) from public, anon;
grant execute on function app.can_access_occurrence_id(uuid) to authenticated;

-- Impede escalação de privilégio via auto-edição de perfil: quem não administra
-- a empresa não pode mudar o próprio papel, tenant, departamento ou situação.
create or replace function app.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if app.is_platform_admin() or app.administers_company(old.company_id) then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.company_id is distinct from old.company_id
     or new.department_id is distinct from old.department_id
     or new.status is distinct from old.status then
    raise exception 'Alteração de papel, empresa, departamento ou situação exige perfil de administrador';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on profiles
  for each row execute function app.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- Privilégios de tabela
--
-- RLS filtra linhas, mas o PostgREST exige também o GRANT. Revogamos tudo de
-- `anon` para que nenhuma tabela nova fique exposta por descuido.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant select, insert, update, delete on
  companies, company_settings, branches, departments,
  profiles, user_branches,
  occurrence_types, categories, subjects,
  occurrences, occurrence_events, occurrence_messages,
  attachments, occurrence_tasks, occurrence_ratings
to authenticated;

grant select on plans, audit_logs to authenticated;

alter table plans               enable row level security;
alter table companies           enable row level security;
alter table company_settings    enable row level security;
alter table branches            enable row level security;
alter table departments         enable row level security;
alter table profiles            enable row level security;
alter table user_branches       enable row level security;
alter table occurrence_types    enable row level security;
alter table categories          enable row level security;
alter table subjects            enable row level security;
alter table occurrences         enable row level security;
alter table occurrence_events   enable row level security;
alter table occurrence_messages enable row level security;
alter table attachments         enable row level security;
alter table occurrence_tasks    enable row level security;
alter table occurrence_ratings  enable row level security;
alter table audit_logs          enable row level security;
-- Sem nenhuma policy: ninguém alcança diretamente. Só a função de protocolo,
-- que é SECURITY DEFINER e roda como dona da tabela.
alter table protocol_counters   enable row level security;

-- --------------------------------------------------------------- planos -----
create policy plans_select on plans
  for select to authenticated using (true);

-- ------------------------------------------------------------- empresas -----
create policy companies_select on companies
  for select to authenticated
  using (app.belongs_to_company(id));

create policy companies_update on companies
  for update to authenticated
  using (app.administers_company(id))
  with check (app.administers_company(id));

create policy companies_insert on companies
  for insert to authenticated
  with check (app.is_platform_admin());

create policy companies_delete on companies
  for delete to authenticated
  using (app.is_platform_admin());

-- -------------------------------------------------------- configurações -----
create policy company_settings_select on company_settings
  for select to authenticated
  using (app.belongs_to_company(company_id));

create policy company_settings_write on company_settings
  for all to authenticated
  using (app.administers_company(company_id))
  with check (app.administers_company(company_id));

-- --------------------------------------------------------------- filiais ----
create policy branches_select on branches
  for select to authenticated
  using (app.belongs_to_company(company_id) and app.can_access_branch(id));

create policy branches_write on branches
  for all to authenticated
  using (app.administers_company(company_id))
  with check (app.administers_company(company_id));

-- --------------------------------------------------------- departamentos ----
create policy departments_select on departments
  for select to authenticated
  using (app.belongs_to_company(company_id));

create policy departments_write on departments
  for all to authenticated
  using (app.administers_company(company_id))
  with check (app.administers_company(company_id));

-- --------------------------------------------------------------- perfis -----
-- Todo mundo da empresa enxerga os colegas: é o que alimenta os seletores de
-- responsável e os filtros por operador.
create policy profiles_select on profiles
  for select to authenticated
  using (id = auth.uid() or app.belongs_to_company(company_id));

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_write on profiles
  for all to authenticated
  using (app.administers_company(company_id))
  with check (app.administers_company(company_id));

-- ------------------------------------------------- vínculo com filiais ------
create policy user_branches_select on user_branches
  for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = user_branches.profile_id
        and app.belongs_to_company(p.company_id)
    )
  );

create policy user_branches_write on user_branches
  for all to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = user_branches.profile_id
        and app.administers_company(p.company_id)
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = user_branches.profile_id
        and app.administers_company(p.company_id)
    )
  );

-- ----------------------------------------------------------- taxonomia ------
create policy occurrence_types_select on occurrence_types
  for select to authenticated using (app.belongs_to_company(company_id));
create policy occurrence_types_write on occurrence_types
  for all to authenticated
  using (app.administers_company(company_id))
  with check (app.administers_company(company_id));

create policy categories_select on categories
  for select to authenticated using (app.belongs_to_company(company_id));
create policy categories_write on categories
  for all to authenticated
  using (app.administers_company(company_id))
  with check (app.administers_company(company_id));

create policy subjects_select on subjects
  for select to authenticated using (app.belongs_to_company(company_id));
create policy subjects_write on subjects
  for all to authenticated
  using (app.administers_company(company_id))
  with check (app.administers_company(company_id));

-- --------------------------------------------------------- ocorrências ------
create policy occurrences_select on occurrences
  for select to authenticated
  using (app.can_access_occurrence(company_id, branch_id, department_id, assignee_id));

-- Registro manual pela equipe (atendimento telefônico ou presencial).
create policy occurrences_insert on occurrences
  for insert to authenticated
  with check (
    app.belongs_to_company(company_id)
    and app.current_role() in ('platform_admin', 'company_admin', 'ombudsman')
  );

create policy occurrences_update on occurrences
  for update to authenticated
  using (app.can_access_occurrence(company_id, branch_id, department_id, assignee_id))
  with check (app.can_access_occurrence(company_id, branch_id, department_id, assignee_id));

-- Manifestação não se apaga: encerra-se, cancela-se ou descarta-se.
create policy occurrences_delete on occurrences
  for delete to authenticated
  using (app.is_platform_admin());

-- ------------------------------------------------------------- timeline -----
-- Append-only: sem policy de update ou delete, nem para administrador.
create policy occurrence_events_select on occurrence_events
  for select to authenticated using (app.can_access_occurrence_id(occurrence_id));
create policy occurrence_events_insert on occurrence_events
  for insert to authenticated with check (app.can_access_occurrence_id(occurrence_id));

-- ------------------------------------------------------------ mensagens -----
create policy occurrence_messages_select on occurrence_messages
  for select to authenticated using (app.can_access_occurrence_id(occurrence_id));
create policy occurrence_messages_insert on occurrence_messages
  for insert to authenticated
  with check (app.can_access_occurrence_id(occurrence_id) and author = 'operador');
-- Update existe apenas para marcar leitura.
create policy occurrence_messages_update on occurrence_messages
  for update to authenticated
  using (app.can_access_occurrence_id(occurrence_id))
  with check (app.can_access_occurrence_id(occurrence_id));

-- -------------------------------------------------------------- anexos ------
create policy attachments_select on attachments
  for select to authenticated using (app.can_access_occurrence_id(occurrence_id));
create policy attachments_insert on attachments
  for insert to authenticated with check (app.can_access_occurrence_id(occurrence_id));
create policy attachments_delete on attachments
  for delete to authenticated
  using (app.can_access_occurrence_id(occurrence_id) and app.administers_company(company_id));

-- --------------------------------------------------------- ações internas ---
create policy occurrence_tasks_select on occurrence_tasks
  for select to authenticated
  using (app.can_access_occurrence_id(occurrence_id) or assignee_id = auth.uid());
create policy occurrence_tasks_write on occurrence_tasks
  for all to authenticated
  using (app.can_access_occurrence_id(occurrence_id) or assignee_id = auth.uid())
  with check (app.can_access_occurrence_id(occurrence_id));

-- ---------------------------------------------------------- avaliações ------
-- Quem avalia é o manifestante, pelo canal público. Aqui é só leitura.
create policy occurrence_ratings_select on occurrence_ratings
  for select to authenticated using (app.can_access_occurrence_id(occurrence_id));

-- ------------------------------------------------------------ auditoria -----
-- Escrita apenas pelo gatilho SECURITY DEFINER; nenhuma policy de insert.
create policy audit_logs_select on audit_logs
  for select to authenticated
  using (app.is_platform_admin() or app.administers_company(company_id));

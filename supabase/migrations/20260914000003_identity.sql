-- Identidade e autorização: perfis, vínculo com filiais e funções auxiliares.

-- Um perfil por usuário do Supabase Auth.
-- company_id é null apenas para platform_admin, que não pertence a um tenant.
create table profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  company_id     uuid references companies (id) on delete cascade,

  full_name      text not null,
  tax_id         text check (tax_id ~ '^[0-9]{11}$'),   -- CPF, somente dígitos
  email          text not null,
  phone          text,
  job_title      text,                                  -- cargo
  department_id  uuid references departments (id) on delete set null,

  role           app_role not null,
  status         record_status not null default 'ativo',

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Invariante central do multi-tenant: só o administrador da plataforma vive
  -- fora de uma empresa; todo outro perfil pertence obrigatoriamente a uma.
  constraint profiles_tenant_scope check (
    (role = 'platform_admin' and company_id is null)
    or (role <> 'platform_admin' and company_id is not null)
  ),

  -- Alvo das FKs compostas: só se atribui ocorrência a alguém da mesma empresa.
  constraint profiles_id_company_unique unique (id, company_id)
);

create index profiles_company_idx on profiles (company_id);
create index profiles_company_role_idx on profiles (company_id, role);
create index profiles_department_idx on profiles (department_id);

-- Acesso do usuário às unidades. Sem nenhuma linha aqui, o usuário enxerga
-- todas as filiais da sua empresa (ver app.can_access_branch).
create table user_branches (
  profile_id  uuid not null references profiles (id) on delete cascade,
  branch_id   uuid not null references branches (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, branch_id)
);

create index user_branches_branch_idx on user_branches (branch_id);

create trigger profiles_touch before update on profiles for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Funções de autorização
--
-- Todas são SECURITY DEFINER porque precisam ler `profiles` para decidir o que
-- o usuário pode ver — e as próprias políticas de `profiles` chamam estas
-- funções. Sem SECURITY DEFINER isso seria uma recursão infinita de RLS.
--
-- Por serem SECURITY DEFINER, `search_path` é fixado para impedir que um
-- objeto criado por outro usuário sequestre a resolução de nomes.
-- ---------------------------------------------------------------------------

create or replace function app.current_role()
returns app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from profiles p
  where p.id = auth.uid()
    and p.status = 'ativo';
$$;

create or replace function app.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.company_id
  from profiles p
  where p.id = auth.uid()
    and p.status = 'ativo';
$$;

create or replace function app.current_department_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.department_id
  from profiles p
  where p.id = auth.uid()
    and p.status = 'ativo';
$$;

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.status = 'ativo'
      and p.role = 'platform_admin'
  );
$$;

-- Pertence à empresa informada (ou é admin da plataforma, que atravessa tudo).
create or replace function app.belongs_to_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_platform_admin()
      or (target_company_id is not null and target_company_id = app.current_company_id());
$$;

-- Administra a empresa informada: admin da plataforma ou company_admin dela.
create or replace function app.administers_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_platform_admin()
      or (
        target_company_id is not null
        and target_company_id = app.current_company_id()
        and app.current_role() = 'company_admin'
      );
$$;

-- Acesso à filial. Usuário sem vínculo explícito enxerga todas as filiais da
-- sua empresa; com vínculo, apenas as listadas. Ocorrência sem filial
-- (branch_id null) é visível a quem pertence à empresa.
create or replace function app.can_access_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when app.is_platform_admin() then true
    when target_branch_id is null then true
    when not exists (
      select 1 from user_branches ub where ub.profile_id = auth.uid()
    ) then true
    else exists (
      select 1
      from user_branches ub
      where ub.profile_id = auth.uid()
        and ub.branch_id = target_branch_id
    )
  end;
$$;

-- Visibilidade de uma ocorrência, por perfil:
--   company_admin, ombudsman  -> toda a empresa, limitado às filiais permitidas
--   manager, area_responsible -> apenas o próprio departamento ou o que lhe foi
--                                atribuído nominalmente
create or replace function app.can_access_occurrence(
  target_company_id    uuid,
  target_branch_id     uuid,
  target_department_id uuid,
  target_assignee_id   uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when app.is_platform_admin() then true
    when target_company_id is null or target_company_id <> app.current_company_id() then false
    when not app.can_access_branch(target_branch_id) then false
    when app.current_role() in ('company_admin', 'ombudsman') then true
    when app.current_role() in ('manager', 'area_responsible') then
      target_assignee_id = auth.uid()
      or (target_department_id is not null and target_department_id = app.current_department_id())
    else false
  end;
$$;

revoke all on function
  app.current_role(),
  app.current_company_id(),
  app.current_department_id(),
  app.is_platform_admin(),
  app.belongs_to_company(uuid),
  app.administers_company(uuid),
  app.can_access_branch(uuid),
  app.can_access_occurrence(uuid, uuid, uuid, uuid)
from public, anon;

grant execute on function
  app.current_role(),
  app.current_company_id(),
  app.current_department_id(),
  app.is_platform_admin(),
  app.belongs_to_company(uuid),
  app.administers_company(uuid),
  app.can_access_branch(uuid),
  app.can_access_occurrence(uuid, uuid, uuid, uuid)
to authenticated;

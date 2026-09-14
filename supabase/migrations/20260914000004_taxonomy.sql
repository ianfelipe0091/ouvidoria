-- Classificação: tipos de ocorrência, categorias e assuntos.
-- Tudo por empresa: cada cliente configura a sua própria taxonomia.

create table occurrence_types (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies (id) on delete cascade,
  name        text not null,
  slug        text not null,
  -- Marca os tipos criados pelo sistema no cadastro da empresa. A empresa pode
  -- desativá-los, mas apagá-los quebraria ocorrências já classificadas.
  is_system   boolean not null default false,
  sort_order  integer not null default 0,
  status      record_status not null default 'ativo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint occurrence_types_slug_unique unique (company_id, slug)
,
  constraint occurrence_types_id_company_unique unique (id, company_id)
);

create index occurrence_types_company_idx on occurrence_types (company_id, status);

create table categories (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies (id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  status      record_status not null default 'ativo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint categories_name_unique unique (company_id, name)
,
  constraint categories_id_company_unique unique (id, company_id)
);

create index categories_company_idx on categories (company_id, status);

create table subjects (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id) on delete cascade,
  category_id  uuid not null references categories (id) on delete cascade,
  name         text not null,
  sort_order   integer not null default 0,
  status       record_status not null default 'ativo',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint subjects_name_unique unique (category_id, name)
,
  constraint subjects_id_company_unique unique (id, company_id)
);

create index subjects_company_idx on subjects (company_id, status);
create index subjects_category_idx on subjects (category_id);

create trigger occurrence_types_touch before update on occurrence_types for each row execute function app.touch_updated_at();
create trigger categories_touch       before update on categories       for each row execute function app.touch_updated_at();
create trigger subjects_touch         before update on subjects         for each row execute function app.touch_updated_at();

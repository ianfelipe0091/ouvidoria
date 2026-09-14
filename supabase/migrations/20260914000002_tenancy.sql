-- Tenancy: planos, empresas clientes, configurações, filiais e departamentos.

-- Planos comerciais. Os limites são conferidos na aplicação; ficam aqui para
-- que a arquitetura já nasça preparada para cobrança, como previsto na Fase 3.
create table plans (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  max_branches   integer,        -- null = ilimitado
  max_users      integer,        -- null = ilimitado
  monthly_price  numeric(10, 2),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Empresa cliente. É a raiz do tenant: toda tabela multiempresa referencia
-- companies.id, direta ou indiretamente.
create table companies (
  id                  uuid primary key default gen_random_uuid(),

  -- Identifica a empresa na URL do canal público: /ouvidoria/<slug>
  slug                text not null unique
                      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 63),

  legal_name          text not null,                 -- razão social
  trade_name          text,                          -- nome fantasia
  tax_id              text not null unique,          -- CNPJ, somente dígitos
  email               text not null,
  phone               text,
  whatsapp            text,
  website             text,

  address_street      text,
  address_number      text,
  address_complement  text,
  address_district    text,
  address_city        text,
  address_state       char(2),
  address_zip         text,

  logo_url            text,

  contact_name        text,                          -- responsável
  contact_email       text,
  contact_phone       text,

  plan_id             uuid references plans (id) on delete set null,
  status              company_status not null default 'ativa',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint companies_tax_id_digits check (tax_id ~ '^[0-9]{14}$')
);

create index companies_status_idx on companies (status);
create index companies_plan_idx on companies (plan_id);

-- Configuração do canal de ouvidoria. 1:1 com a empresa, em tabela separada
-- porque muda por outro motivo e com outra frequência que o cadastro.
create table company_settings (
  company_id            uuid primary key references companies (id) on delete cascade,

  channel_name          text,                        -- nome exibido no canal
  logo_url              text,
  primary_color         text not null default '#1f2937'
                        check (primary_color ~* '^#[0-9a-f]{6}$'),
  secondary_color       text not null default '#4b5563'
                        check (secondary_color ~* '^#[0-9a-f]{6}$'),
  intro_text            text,                        -- texto de apresentação
  privacy_policy_text   text,

  notification_email    text,

  -- Prazo padrão de resposta, em dias corridos.
  default_sla_days      integer not null default 10 check (default_sla_days between 1 and 365),
  -- Antecedência, em dias, para marcar uma ocorrência como "próxima do vencimento".
  sla_warning_days      integer not null default 2 check (sla_warning_days >= 0),

  allow_anonymous       boolean not null default true,
  allow_attachments     boolean not null default true,
  allow_rating          boolean not null default true,

  max_attachment_mb     integer not null default 10 check (max_attachment_mb between 1 and 100),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint company_settings_warning_lt_sla check (sla_warning_days < default_sla_days)
);

-- Filiais. Não têm credenciais próprias: o acesso se dá por usuários
-- vinculados à filial (ver user_branches).
create table branches (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies (id) on delete cascade,

  name                text not null,
  trade_name          text,
  tax_id              text check (tax_id ~ '^[0-9]{14}$'),
  internal_code       text,                          -- código interno da filial
  is_headquarters     boolean not null default false,

  address_street      text,
  address_number      text,
  address_complement  text,
  address_district    text,
  address_city        text,
  address_state       char(2),
  address_zip         text,

  phone               text,
  whatsapp            text,
  email               text,

  contact_name        text,
  contact_email       text,

  status              record_status not null default 'ativo',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Código interno é único dentro da empresa, não globalmente.
  constraint branches_internal_code_unique unique (company_id, internal_code),

  -- Chave candidata usada como alvo das FKs compostas: qualquer tabela que
  -- aponte para uma filial precisa provar que ela é da mesma empresa.
  constraint branches_id_company_unique unique (id, company_id)
);

create index branches_company_idx on branches (company_id);
create index branches_company_status_idx on branches (company_id, status);

-- Garante no máximo uma matriz por empresa.
create unique index branches_single_hq_idx
  on branches (company_id)
  where is_headquarters;

create table departments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies (id) on delete cascade,
  name        text not null,
  email       text,                                  -- caixa do departamento
  status      record_status not null default 'ativo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint departments_name_unique unique (company_id, name),
  constraint departments_id_company_unique unique (id, company_id)
);

create index departments_company_idx on departments (company_id);

create trigger plans_touch            before update on plans            for each row execute function app.touch_updated_at();
create trigger companies_touch        before update on companies        for each row execute function app.touch_updated_at();
create trigger company_settings_touch before update on company_settings for each row execute function app.touch_updated_at();
create trigger branches_touch         before update on branches         for each row execute function app.touch_updated_at();
create trigger departments_touch      before update on departments      for each row execute function app.touch_updated_at();

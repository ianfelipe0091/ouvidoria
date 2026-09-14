-- Núcleo do produto: manifestações e tudo que orbita o seu ciclo de vida.
--
-- Isolamento entre empresas
-- -------------------------
-- Toda tabela aqui carrega company_id e todas as referências a outras tabelas
-- do tenant são FEITAS POR CHAVE COMPOSTA (id, company_id). Assim o próprio
-- banco recusa uma ocorrência da Empresa A que aponte para a filial, categoria
-- ou responsável da Empresa B — a regra não depende da aplicação lembrar dela.
--
-- As FKs usam ON DELETE SET NULL (coluna), do PostgreSQL 15+, que zera apenas a
-- coluna referenciada. Um SET NULL comum tentaria anular também company_id, que
-- é NOT NULL, e a exclusão falharia.

-- Sequência de protocolo por empresa e por ano: OUV-2026-000184.
create table protocol_counters (
  company_id   uuid not null references companies (id) on delete cascade,
  year         integer not null,
  last_number  integer not null default 0,
  primary key (company_id, year)
);

create table occurrences (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies (id) on delete cascade,

  protocol           text not null,

  -- Código de acompanhamento entregue ao manifestante, guardado com hash.
  -- É o que permite acompanhar a manifestação sem criar conta — inclusive de
  -- forma anônima — por isso nunca é armazenado em texto puro.
  tracking_code_hash text not null,

  branch_id          uuid,
  type_id            uuid,
  category_id        uuid,
  subject_id         uuid,
  department_id      uuid,
  assignee_id        uuid,

  status             occurrence_status not null default 'recebida',

  is_anonymous       boolean not null default false,
  reporter_name      text,
  reporter_tax_id    text,
  reporter_email     text,
  reporter_phone     text,
  reporter_whatsapp  text,

  description        text not null check (length(btrim(description)) >= 10),

  -- Campos circunstanciais: opcionais no MVP, configuráveis por empresa depois.
  occurred_at        date,
  occurred_location  text,
  people_involved    text,
  amount_involved    numeric(14, 2),
  has_witnesses      boolean,
  custom_fields      jsonb not null default '{}'::jsonb,

  opened_at          timestamptz not null default now(),
  due_at             timestamptz not null,
  first_response_at  timestamptz,
  answered_at        timestamptz,
  closed_at          timestamptz,

  answer             text,                       -- resposta ao manifestante
  resolution         occurrence_resolution,
  closing_reason     text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint occurrences_protocol_unique unique (company_id, protocol),
  constraint occurrences_id_company_unique unique (id, company_id),

  constraint occurrences_branch_fk foreign key (branch_id, company_id)
    references branches (id, company_id) on delete set null (branch_id),
  constraint occurrences_type_fk foreign key (type_id, company_id)
    references occurrence_types (id, company_id) on delete set null (type_id),
  constraint occurrences_category_fk foreign key (category_id, company_id)
    references categories (id, company_id) on delete set null (category_id),
  constraint occurrences_subject_fk foreign key (subject_id, company_id)
    references subjects (id, company_id) on delete set null (subject_id),
  constraint occurrences_department_fk foreign key (department_id, company_id)
    references departments (id, company_id) on delete set null (department_id),
  constraint occurrences_assignee_fk foreign key (assignee_id, company_id)
    references profiles (id, company_id) on delete set null (assignee_id),

  -- Manifestação anônima não carrega dado pessoal. A regra vive no banco, e
  -- não só no formulário, para que nenhum caminho de escrita possa violá-la.
  constraint occurrences_anonymous_has_no_pii check (
    not is_anonymous
    or (reporter_name is null and reporter_tax_id is null
        and reporter_email is null and reporter_phone is null
        and reporter_whatsapp is null)
  ),

  -- Encerrada exige data de encerramento, e vice-versa.
  constraint occurrences_closed_consistency check (
    (status in ('encerrada', 'cancelada', 'descartada')) = (closed_at is not null)
  )
);

create index occurrences_company_idx            on occurrences (company_id);
create index occurrences_company_status_idx     on occurrences (company_id, status);
create index occurrences_company_opened_idx     on occurrences (company_id, opened_at desc);
create index occurrences_company_branch_idx     on occurrences (company_id, branch_id);
create index occurrences_company_category_idx   on occurrences (company_id, category_id);
create index occurrences_company_type_idx       on occurrences (company_id, type_id);
create index occurrences_department_idx         on occurrences (department_id);
create index occurrences_assignee_idx           on occurrences (assignee_id);
-- Suporta o filtro de prazo, que só interessa em ocorrências ainda abertas.
create index occurrences_open_due_idx           on occurrences (company_id, due_at)
  where status not in ('encerrada', 'cancelada', 'descartada');

-- Timeline. Append-only: é o registro de rastreabilidade da ocorrência.
create table occurrence_events (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null,
  occurrence_id  uuid not null,

  -- Null quando o autor é o manifestante ou o próprio sistema.
  actor_id       uuid,
  actor_label    text not null default 'sistema',

  event_type     text not null,   -- registrada, encaminhada, status_alterado, ...
  description    text not null,
  metadata       jsonb not null default '{}'::jsonb,

  created_at     timestamptz not null default now(),

  constraint occurrence_events_occurrence_fk foreign key (occurrence_id, company_id)
    references occurrences (id, company_id) on delete cascade,
  constraint occurrence_events_actor_fk foreign key (actor_id, company_id)
    references profiles (id, company_id) on delete set null (actor_id)
);

create index occurrence_events_occurrence_idx on occurrence_events (occurrence_id, created_at);
create index occurrence_events_company_idx on occurrence_events (company_id);

-- Conversa com o manifestante. `is_internal` marca a nota que fica só entre a
-- equipe e nunca é devolvida pelo canal público.
create table occurrence_messages (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null,
  occurrence_id  uuid not null,

  author         message_author not null,
  author_id      uuid,
  body           text not null check (length(btrim(body)) > 0),
  is_internal    boolean not null default false,
  read_at        timestamptz,

  created_at     timestamptz not null default now(),

  constraint occurrence_messages_id_company_unique unique (id, company_id),
  constraint occurrence_messages_occurrence_fk foreign key (occurrence_id, company_id)
    references occurrences (id, company_id) on delete cascade,
  constraint occurrence_messages_author_fk foreign key (author_id, company_id)
    references profiles (id, company_id) on delete set null (author_id),

  -- Mensagem do manifestante nunca é nota interna nem tem autor interno.
  constraint occurrence_messages_manifestante_shape check (
    author <> 'manifestante' or (not is_internal and author_id is null)
  )
);

create index occurrence_messages_occurrence_idx on occurrence_messages (occurrence_id, created_at);
create index occurrence_messages_company_idx on occurrence_messages (company_id);

create table attachments (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null,
  occurrence_id  uuid not null,
  message_id     uuid,

  storage_path   text not null unique,
  file_name      text not null,
  mime_type      text not null,
  size_bytes     bigint not null check (size_bytes > 0),

  uploaded_by    uuid,
  uploaded_by_reporter boolean not null default false,

  created_at     timestamptz not null default now(),

  constraint attachments_occurrence_fk foreign key (occurrence_id, company_id)
    references occurrences (id, company_id) on delete cascade,
  -- message_id nulo desliga a checagem (MATCH SIMPLE): é o anexo preso à
  -- manifestação em si, e não a uma mensagem específica.
  constraint attachments_message_fk foreign key (message_id, company_id)
    references occurrence_messages (id, company_id) on delete cascade,
  constraint attachments_uploader_fk foreign key (uploaded_by, company_id)
    references profiles (id, company_id) on delete set null (uploaded_by)
);

create index attachments_occurrence_idx on attachments (occurrence_id);
create index attachments_company_idx on attachments (company_id);

-- Ações internas: impedem que a ocorrência vire só uma troca de mensagens sem
-- tratamento efetivo.
create table occurrence_tasks (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null,
  occurrence_id  uuid not null,

  title          text not null,
  description    text,
  assignee_id    uuid,
  due_on         date,
  status         task_status not null default 'pendente',
  completed_at   timestamptz,

  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint occurrence_tasks_occurrence_fk foreign key (occurrence_id, company_id)
    references occurrences (id, company_id) on delete cascade,
  constraint occurrence_tasks_assignee_fk foreign key (assignee_id, company_id)
    references profiles (id, company_id) on delete set null (assignee_id),
  constraint occurrence_tasks_creator_fk foreign key (created_by, company_id)
    references profiles (id, company_id) on delete set null (created_by),

  constraint occurrence_tasks_completed_consistency check (
    (status = 'concluida') = (completed_at is not null)
  )
);

create index occurrence_tasks_occurrence_idx on occurrence_tasks (occurrence_id);
create index occurrence_tasks_assignee_idx on occurrence_tasks (assignee_id, status);

-- Avaliação do atendimento, no máximo uma por ocorrência.
create table occurrence_ratings (
  occurrence_id  uuid primary key,
  company_id     uuid not null,
  stars          smallint not null check (stars between 1 and 5),
  comment        text,
  created_at     timestamptz not null default now(),

  constraint occurrence_ratings_occurrence_fk foreign key (occurrence_id, company_id)
    references occurrences (id, company_id) on delete cascade
);

create index occurrence_ratings_company_idx on occurrence_ratings (company_id);

create trigger occurrences_touch      before update on occurrences      for each row execute function app.touch_updated_at();
create trigger occurrence_tasks_touch before update on occurrence_tasks for each row execute function app.touch_updated_at();

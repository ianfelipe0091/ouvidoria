-- Auditoria: quem acessou, alterou, encaminhou, respondeu ou encerrou.
-- Existe desde o início porque, numa ouvidoria, a rastreabilidade é parte do
-- produto — reconstruí-la depois dos fatos é impossível.

-- company_id e actor_id são uuid SEM chave estrangeira, de propósito.
--
-- Um registro de auditoria precisa sobreviver ao que ele audita. Com FK haveria
-- só duas saídas, ambas ruins: ON DELETE SET NULL apagaria de qual empresa foi
-- o evento, e a restrição normal impediria excluir a empresa — na prática o
-- gatilho falha no meio do cascade, porque a linha filha é auditada depois que
-- a empresa já saiu. Por isso o log guarda também actor_email: ele continua
-- legível quando o perfil não existe mais.
create table audit_logs (
  id          bigint generated always as identity primary key,

  -- Null para eventos da administradora da plataforma, que não têm tenant.
  company_id  uuid,

  actor_id    uuid,
  actor_email text,

  action      text not null,        -- insert, update, delete
  entity      text not null,        -- nome da tabela
  entity_id   text,

  -- Só as colunas que realmente mudaram, para o log não virar uma cópia do banco.
  changes     jsonb not null default '{}'::jsonb,

  created_at  timestamptz not null default now()
);

create index audit_logs_company_idx on audit_logs (company_id, created_at desc);
create index audit_logs_entity_idx on audit_logs (entity, entity_id);
create index audit_logs_actor_idx on audit_logs (actor_id, created_at desc);

-- Registra a diferença entre OLD e NEW. Anexada apenas às tabelas cujo
-- histórico importa; não é um gatilho global.
create or replace function app.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changes    jsonb := '{}'::jsonb;
  v_company_id uuid;
  v_entity_id  text;
  v_actor_id   uuid := auth.uid();
  v_key        text;
begin
  if tg_op = 'DELETE' then
    v_changes   := to_jsonb(old);
    v_company_id := (to_jsonb(old) ->> 'company_id')::uuid;
    v_entity_id := to_jsonb(old) ->> 'id';
  elsif tg_op = 'INSERT' then
    v_changes   := to_jsonb(new);
    v_company_id := (to_jsonb(new) ->> 'company_id')::uuid;
    v_entity_id := to_jsonb(new) ->> 'id';
  else
    -- Guarda apenas os campos alterados, com valor anterior e novo.
    for v_key in select jsonb_object_keys(to_jsonb(new)) loop
      if to_jsonb(new) -> v_key is distinct from to_jsonb(old) -> v_key then
        v_changes := v_changes || jsonb_build_object(
          v_key,
          jsonb_build_object('de', to_jsonb(old) -> v_key, 'para', to_jsonb(new) -> v_key)
        );
      end if;
    end loop;
    v_company_id := (to_jsonb(new) ->> 'company_id')::uuid;
    v_entity_id := to_jsonb(new) ->> 'id';

    -- Update que não mudou nada não gera registro.
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into audit_logs (company_id, actor_id, actor_email, action, entity, entity_id, changes)
  values (
    v_company_id,
    v_actor_id,
    (select email from profiles where id = v_actor_id),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_changes
  );

  return coalesce(new, old);
end;
$$;

create trigger occurrences_audit
  after insert or update or delete on occurrences
  for each row execute function app.write_audit_log();

create trigger occurrence_tasks_audit
  after insert or update or delete on occurrence_tasks
  for each row execute function app.write_audit_log();

create trigger profiles_audit
  after insert or update or delete on profiles
  for each row execute function app.write_audit_log();

create trigger branches_audit
  after insert or update or delete on branches
  for each row execute function app.write_audit_log();

-- Situação do prazo, derivada. Fica como função para que dashboard, filtro e
-- relatório usem exatamente a mesma definição de "em atraso".
create or replace function public.occurrence_sla_state(
  p_status       occurrence_status,
  p_due_at       timestamptz,
  p_closed_at    timestamptz,
  p_warning_days integer default 2
)
returns sla_state
language sql
immutable
as $$
  select case
    when p_status in ('encerrada', 'cancelada', 'descartada') then 'concluida'::sla_state
    when now() > p_due_at then 'em_atraso'::sla_state
    when now() >= p_due_at - make_interval(days => p_warning_days) then 'proximo_vencimento'::sla_state
    else 'no_prazo'::sla_state
  end;
$$;

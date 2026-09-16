-- Gravidade por tipo de manifestação, e filtros no dashboard.
--
-- A cor de um tipo não é decoração: denúncia e elogio carregam valência oposta,
-- e é isso que justifica usar a escala de status (grave → positivo) em vez de
-- uma paleta categórica. Cor categórica aqui desperdiçaria o canal de
-- identidade re-codificando o que o comprimento da barra já mostra.

create type occurrence_severity as enum (
  'grave',     -- exige ação imediata: denúncia
  'atencao',   -- insatisfação a tratar: reclamação, crítica
  'neutro',    -- sem valência: sugestão, solicitação, dúvida
  'positivo'   -- reconhecimento: elogio
);

alter table occurrence_types
  add column severity occurrence_severity not null default 'neutro';

comment on column occurrence_types.severity is
  'Gravidade do tipo. Define a cor e a forma do marcador nos indicadores.';

-- Classifica os tipos que o sistema cria. Tipos próprios da empresa nascem
-- neutros e podem ser reclassificados na tela de Categorias.
update occurrence_types set severity = case slug
  when 'denuncia'    then 'grave'
  when 'reclamacao'  then 'atencao'
  when 'critica'     then 'atencao'
  when 'elogio'      then 'positivo'
  else 'neutro'
end::occurrence_severity
where is_system;

-- O provisionamento de novas empresas também já nasce classificado.
create or replace function app.default_severity(p_slug text)
returns occurrence_severity
language sql
immutable
as $$
  select case p_slug
    when 'denuncia'   then 'grave'
    when 'reclamacao' then 'atencao'
    when 'critica'    then 'atencao'
    when 'elogio'     then 'positivo'
    else 'neutro'
  end::occurrence_severity;
$$;

create or replace function app.set_type_severity()
returns trigger
language plpgsql
as $$
begin
  -- Só decide por conta própria nos tipos do sistema; um tipo criado pela
  -- empresa mantém o que ela escolheu.
  if new.is_system then
    new.severity := app.default_severity(new.slug);
  end if;
  return new;
end;
$$;

create trigger occurrence_types_default_severity
  before insert on occurrence_types
  for each row execute function app.set_type_severity();

-- ---------------------------------------------------------------------------
-- Dashboard com filtros
--
-- Os três filtros entram em TODAS as funções para que os cartões, o gráfico de
-- evolução e as quebras respondam ao mesmo recorte. Filtrar só uma parte da
-- tela produziria números que não fecham entre si.
-- ---------------------------------------------------------------------------

drop function if exists public.dashboard_summary(integer);
drop function if exists public.dashboard_timeseries(integer);
drop function if exists public.dashboard_breakdown(text, integer);

create or replace function public.dashboard_summary(
  p_days      integer default 30,
  p_state     text default null,
  p_branch_id uuid default null,
  p_type_id   uuid default null
)
returns jsonb
language sql
stable
as $$
  with escopo as (
    select o.*
    from occurrences o
    left join branches b on b.id = o.branch_id
    where o.opened_at >= now() - make_interval(days => p_days)
      and (p_state is null or b.address_state = upper(p_state))
      and (p_branch_id is null or o.branch_id = p_branch_id)
      and (p_type_id is null or o.type_id = p_type_id)
  )
  select jsonb_build_object(
    'total',                count(*),
    'novas',                count(*) filter (where status = 'recebida'),
    'em_analise',           count(*) filter (where status = 'em_analise'),
    'em_tratamento',        count(*) filter (where status = 'em_tratamento'),
    'aguardando_resposta',  count(*) filter (where status in ('aguardando_resposta', 'aguardando_informacoes')),
    'respondidas',          count(*) filter (where status = 'respondida'),
    'encerradas',           count(*) filter (where status = 'encerrada'),
    'anonimas',             count(*) filter (where is_anonymous),
    'em_atraso',            count(*) filter (
                              where status not in ('encerrada', 'cancelada', 'descartada')
                                and due_at < now()
                            ),
    'tempo_medio_resposta', round(
                              avg(extract(epoch from (answered_at - opened_at)) / 86400)
                                filter (where answered_at is not null)
                            , 1)
  )
  from escopo;
$$;

create or replace function public.dashboard_timeseries(
  p_days      integer default 30,
  p_state     text default null,
  p_branch_id uuid default null,
  p_type_id   uuid default null
)
returns table (dia date, total bigint)
language sql
stable
as $$
  select d.dia::date, count(o.id) as total
  from generate_series(
         (now() - make_interval(days => p_days - 1))::date,
         now()::date,
         interval '1 day'
       ) as d(dia)
  left join occurrences o
    on o.opened_at >= d.dia
   and o.opened_at < d.dia + interval '1 day'
   and (p_branch_id is null or o.branch_id = p_branch_id)
   and (p_type_id is null or o.type_id = p_type_id)
   and (p_state is null or exists (
         select 1 from branches b
         where b.id = o.branch_id and b.address_state = upper(p_state)))
  group by d.dia
  order by d.dia;
$$;

/**
 * Contagem por dimensão.
 *
 * Devolve também a gravidade quando a dimensão é 'tipo': é ela que decide a cor
 * e a forma do marcador, e buscá-la numa segunda consulta abriria espaço para
 * as duas discordarem.
 */
create or replace function public.dashboard_breakdown(
  p_dimension text,
  p_days      integer default 30,
  p_state     text default null,
  p_branch_id uuid default null,
  p_type_id   uuid default null
)
returns table (rotulo text, total bigint, severidade text)
language sql
stable
as $$
  select
    coalesce(
      case p_dimension
        when 'tipo'      then t.name
        when 'filial'    then b.name
        when 'categoria' then c.name
        when 'estado'    then b.address_state
        when 'status'    then o.status::text
      end,
      'Não informado'
    ) as rotulo,
    count(*) as total,
    case when p_dimension = 'tipo' then max(t.severity::text) end as severidade
  from occurrences o
  left join occurrence_types t on t.id = o.type_id
  left join branches b         on b.id = o.branch_id
  left join categories c       on c.id = o.category_id
  where o.opened_at >= now() - make_interval(days => p_days)
    and p_dimension in ('tipo', 'filial', 'categoria', 'status', 'estado')
    and (p_state is null or b.address_state = upper(p_state))
    and (p_branch_id is null or o.branch_id = p_branch_id)
    and (p_type_id is null or o.type_id = p_type_id)
  group by 1
  order by 2 desc, 1;
$$;

/** Estados com filial cadastrada, para alimentar o filtro. */
create or replace function public.company_states()
returns table (uf text, filiais bigint)
language sql
stable
as $$
  select address_state, count(*)
  from branches
  where status = 'ativo' and address_state is not null
  group by address_state
  order by address_state;
$$;

grant execute on function public.dashboard_summary(integer, text, uuid, uuid) to authenticated;
grant execute on function public.dashboard_timeseries(integer, text, uuid, uuid) to authenticated;
grant execute on function public.dashboard_breakdown(text, integer, text, uuid, uuid) to authenticated;
grant execute on function public.company_states() to authenticated;

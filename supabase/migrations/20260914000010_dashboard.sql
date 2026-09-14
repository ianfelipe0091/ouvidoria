-- Agregações do dashboard.
--
-- São SECURITY INVOKER (o padrão), e isso é essencial: rodando com os
-- privilégios de quem chama, as políticas de RLS continuam valendo e cada
-- empresa só soma as próprias ocorrências. Uma função SECURITY DEFINER aqui
-- vazaria os números de todos os tenants.

-- Contadores do topo do painel, no período escolhido.
create or replace function public.dashboard_summary(p_days integer default 30)
returns jsonb
language sql
stable
as $$
  with escopo as (
    select o.*,
           coalesce(
             (select cs.sla_warning_days from company_settings cs where cs.company_id = o.company_id),
             2
           ) as warning_days
    from occurrences o
    where o.opened_at >= now() - make_interval(days => p_days)
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
    -- Tempo médio, em dias, entre abertura e resposta. Null enquanto ninguém
    -- respondeu — média de conjunto vazio não é zero.
    'tempo_medio_resposta', round(
                              avg(extract(epoch from (answered_at - opened_at)) / 86400)
                                filter (where answered_at is not null)
                            , 1)
  )
  from escopo;
$$;

-- Série temporal para o gráfico de evolução. Dias sem manifestação aparecem
-- com zero: um buraco na série mentiria sobre a tendência.
create or replace function public.dashboard_timeseries(p_days integer default 30)
returns table (dia date, total bigint)
language sql
stable
as $$
  select d.dia::date,
         count(o.id) as total
  from generate_series(
         (now() - make_interval(days => p_days - 1))::date,
         now()::date,
         interval '1 day'
       ) as d(dia)
  left join occurrences o
    on o.opened_at >= d.dia
   and o.opened_at < d.dia + interval '1 day'
  group by d.dia
  order by d.dia;
$$;

-- Contagem por dimensão, para as barras ordenadas. Uma função só, com a
-- dimensão como parâmetro, evita quatro funções quase idênticas.
create or replace function public.dashboard_breakdown(
  p_dimension text,
  p_days integer default 30
)
returns table (rotulo text, total bigint)
language sql
stable
as $$
  select
    coalesce(
      case p_dimension
        when 'tipo'      then t.name
        when 'filial'    then b.name
        when 'categoria' then c.name
        when 'status'    then o.status::text
      end,
      'Não informado'
    ) as rotulo,
    count(*) as total
  from occurrences o
  left join occurrence_types t on t.id = o.type_id
  left join branches b         on b.id = o.branch_id
  left join categories c       on c.id = o.category_id
  where o.opened_at >= now() - make_interval(days => p_days)
    and p_dimension in ('tipo', 'filial', 'categoria', 'status')
  group by 1
  order by 2 desc, 1;
$$;

grant execute on function public.dashboard_summary(integer) to authenticated;
grant execute on function public.dashboard_timeseries(integer) to authenticated;
grant execute on function public.dashboard_breakdown(text, integer) to authenticated;

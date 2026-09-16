-- Gráficos de análise: velocímetro de cumprimento de prazo (SLA) e fluxo de
-- entradas × saídas. Ambos respeitam os mesmos filtros do resto do dashboard.

/**
 * Velocímetro do SLA: qual fração das manifestações está "no prazo".
 *
 * A conta separa quatro casos e reduz a um número de saúde 0–100:
 *   - resolvida no prazo   → answered_at <= due_at
 *   - resolvida atrasada   → answered_at  > due_at
 *   - aberta e no prazo    → sem resposta, due_at >= agora
 *   - aberta e atrasada    → sem resposta, due_at  < agora
 * taxa = no prazo / (no prazo + atrasada). Manifestação cancelada/descartada
 * não entra: não havia compromisso de resposta a cumprir.
 *
 * É o "relógio" da operação — a leitura única de "estamos dando conta dos
 * prazos?" — e por isso deriva de uma regra só, aqui, em vez de ser remontada
 * na interface.
 */
create or replace function public.dashboard_sla_gauge(
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
      and o.status not in ('cancelada', 'descartada')
      and (p_state is null or b.address_state = upper(p_state))
      and (p_branch_id is null or o.branch_id = p_branch_id)
      and (p_type_id is null or o.type_id = p_type_id)
  ),
  contagem as (
    select
      count(*) filter (
        where (answered_at is not null and answered_at <= due_at)
           or (answered_at is null and status not in ('encerrada','cancelada','descartada') and due_at >= now())
      ) as no_prazo,
      count(*) filter (
        where (answered_at is not null and answered_at > due_at)
           or (answered_at is null and status not in ('encerrada','cancelada','descartada') and due_at < now())
      ) as atrasadas,
      count(*) filter (
        where status not in ('encerrada','cancelada','descartada') and due_at < now()
      ) as abertas_atrasadas
    from escopo
  )
  select jsonb_build_object(
    'no_prazo',          no_prazo,
    'atrasadas',         atrasadas,
    'abertas_atrasadas', abertas_atrasadas,
    'avaliadas',         no_prazo + atrasadas,
    -- null quando não há nada avaliável — média de conjunto vazio não é 0%.
    'taxa', case when no_prazo + atrasadas > 0
                 then round(no_prazo::numeric * 100 / (no_prazo + atrasadas), 1)
                 else null end
  )
  from contagem;
$$;

/**
 * Fluxo do período: quantas entraram e quantas foram encerradas por dia.
 *
 * Responde à pergunta que nenhum outro gráfico do painel responde: a equipe
 * está encerrando no mesmo ritmo em que recebe? Dias sem movimento aparecem
 * com zero — um buraco na série sugeriria uma queda que não houve.
 */
create or replace function public.dashboard_flow(
  p_days      integer default 30,
  p_state     text default null,
  p_branch_id uuid default null,
  p_type_id   uuid default null
)
returns table (dia date, recebidas bigint, encerradas bigint)
language sql
stable
as $$
  with dias as (
    select generate_series(
      (now() - make_interval(days => p_days - 1))::date,
      now()::date,
      interval '1 day'
    )::date as dia
  ),
  escopo as (
    select o.opened_at, o.closed_at
    from occurrences o
    left join branches b on b.id = o.branch_id
    where (p_state is null or b.address_state = upper(p_state))
      and (p_branch_id is null or o.branch_id = p_branch_id)
      and (p_type_id is null or o.type_id = p_type_id)
  )
  select
    d.dia,
    count(e.opened_at) filter (where e.opened_at::date = d.dia) as recebidas,
    count(e.closed_at) filter (where e.closed_at::date = d.dia) as encerradas
  from dias d
  left join escopo e
    on e.opened_at::date = d.dia or e.closed_at::date = d.dia
  group by d.dia
  order by d.dia;
$$;

grant execute on function public.dashboard_sla_gauge(integer, text, uuid, uuid) to authenticated;
grant execute on function public.dashboard_flow(integer, text, uuid, uuid) to authenticated;

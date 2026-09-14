-- Canal público da ouvidoria.
--
-- O papel `anon` não tem GRANT em nenhuma tabela (ver 0007). O manifestante
-- interage apenas por estas funções, que são SECURITY DEFINER e exigem
-- protocolo + código de acompanhamento antes de devolver qualquer dado.
--
-- O código de acompanhamento é mostrado uma única vez, no registro, e guardado
-- apenas como hash bcrypt. Perdido o código, não há como recuperá-lo — é o que
-- permite acompanhar uma denúncia anônima sem vinculá-la a uma identidade.

-- Protocolo sequencial por empresa e por ano. O UPSERT incrementa e devolve o
-- número na mesma instrução, então dois registros simultâneos não colidem.
create or replace function app.next_protocol(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year   integer := extract(year from now())::integer;
  v_number integer;
begin
  insert into protocol_counters (company_id, year, last_number)
  values (p_company_id, v_year, 1)
  on conflict (company_id, year)
    do update set last_number = protocol_counters.last_number + 1
  returning last_number into v_number;

  return 'OUV-' || v_year::text || '-' || lpad(v_number::text, 6, '0');
end;
$$;

-- Código de acompanhamento legível: 4 grupos de 4, sem caracteres ambíguos
-- (0/O, 1/I), porque na prática ele é anotado no papel ou ditado por telefone.
create or replace function app.random_tracking_code()
returns text
language plpgsql
volatile
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  i integer;
begin
  for i in 1..16 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    if i % 4 = 0 and i < 16 then
      v_code := v_code || '-';
    end if;
  end loop;
  return v_code;
end;
$$;

-- Resolve a ocorrência a partir de empresa + protocolo + código.
--
-- O escopo por empresa é obrigatório, não uma conveniência: o protocolo é
-- sequencial POR EMPRESA, então "OUV-2026-000001" existe em todo tenant. Sem
-- filtrar por company_id, um par protocolo+código válido resolveria para a
-- ocorrência de outra empresa que casasse primeiro.
--
-- Devolve null quando qualquer um dos três não confere — quem chama não
-- distingue "não existe" de "código errado", para não confirmar a existência
-- de um protocolo a quem não tem o código.
create or replace function app.resolve_occurrence(
  p_company_id    uuid,
  p_protocol      text,
  p_tracking_code text
)
returns occurrences
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select o.*
  from occurrences o
  where o.company_id = p_company_id
    and o.protocol = upper(btrim(p_protocol))
    and o.tracking_code_hash = crypt(upper(btrim(p_tracking_code)), o.tracking_code_hash);
$$;

-- ---------------------------------------------------------------------------
-- 1. Configuração pública do canal: o que a página da empresa precisa para se
--    montar (identidade visual, textos e opções do formulário).
-- ---------------------------------------------------------------------------
create or replace function public.get_ouvidoria_channel(p_company_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_company  companies;
  v_settings company_settings;
begin
  select * into v_company from companies where slug = p_company_slug and status = 'ativa';
  if not found then
    raise exception 'Canal de ouvidoria não encontrado' using errcode = 'no_data_found';
  end if;

  select * into v_settings from company_settings where company_id = v_company.id;

  return jsonb_build_object(
    'company', jsonb_build_object(
      'slug', v_company.slug,
      'name', coalesce(v_settings.channel_name, v_company.trade_name, v_company.legal_name),
      'logo_url', coalesce(v_settings.logo_url, v_company.logo_url)
    ),
    'branding', jsonb_build_object(
      'primary_color', coalesce(v_settings.primary_color, '#1f2937'),
      'secondary_color', coalesce(v_settings.secondary_color, '#4b5563'),
      'intro_text', v_settings.intro_text,
      'privacy_policy_text', v_settings.privacy_policy_text
    ),
    'options', jsonb_build_object(
      'allow_anonymous', coalesce(v_settings.allow_anonymous, true),
      'allow_attachments', coalesce(v_settings.allow_attachments, true),
      'allow_rating', coalesce(v_settings.allow_rating, true),
      'max_attachment_mb', coalesce(v_settings.max_attachment_mb, 10)
    ),
    'types', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug) order by t.sort_order, t.name)
      from occurrence_types t
      where t.company_id = v_company.id and t.status = 'ativo'
    ), '[]'::jsonb),
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'city', b.address_city) order by b.is_headquarters desc, b.name)
      from branches b
      where b.company_id = v_company.id and b.status = 'ativo'
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'subjects', coalesce((
          select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.sort_order, s.name)
          from subjects s where s.category_id = c.id and s.status = 'ativo'
        ), '[]'::jsonb)
      ) order by c.sort_order, c.name)
      from categories c
      where c.company_id = v_company.id and c.status = 'ativo'
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Registro da manifestação. Devolve protocolo e código — o código em texto
--    puro aparece AQUI e em nenhum outro lugar, nunca mais.
-- ---------------------------------------------------------------------------
create or replace function public.create_manifestacao(
  p_company_slug      text,
  p_description       text,
  p_type_id           uuid    default null,
  p_branch_id         uuid    default null,
  p_category_id       uuid    default null,
  p_subject_id        uuid    default null,
  p_is_anonymous      boolean default false,
  p_reporter_name     text    default null,
  p_reporter_tax_id   text    default null,
  p_reporter_email    text    default null,
  p_reporter_phone    text    default null,
  p_reporter_whatsapp text    default null,
  p_occurred_at       date    default null,
  p_occurred_location text    default null,
  p_people_involved   text    default null,
  p_amount_involved   numeric default null,
  p_has_witnesses     boolean default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_company       companies;
  v_settings      company_settings;
  v_protocol      text;
  v_tracking_code text;
  v_occurrence_id uuid;
begin
  select * into v_company from companies where slug = p_company_slug and status = 'ativa';
  if not found then
    raise exception 'Canal de ouvidoria não encontrado' using errcode = 'no_data_found';
  end if;

  select * into v_settings from company_settings where company_id = v_company.id;

  if p_is_anonymous and not coalesce(v_settings.allow_anonymous, true) then
    raise exception 'Esta ouvidoria não aceita manifestações anônimas'
      using errcode = 'check_violation';
  end if;

  if not p_is_anonymous and coalesce(btrim(p_reporter_name), '') = '' then
    raise exception 'Informe seu nome ou escolha registrar de forma anônima'
      using errcode = 'check_violation';
  end if;

  v_protocol      := app.next_protocol(v_company.id);
  v_tracking_code := app.random_tracking_code();

  insert into occurrences (
    company_id, protocol, tracking_code_hash,
    branch_id, type_id, category_id, subject_id,
    is_anonymous,
    reporter_name, reporter_tax_id, reporter_email, reporter_phone, reporter_whatsapp,
    description, occurred_at, occurred_location, people_involved, amount_involved, has_witnesses,
    due_at
  ) values (
    v_company.id, v_protocol, crypt(v_tracking_code, gen_salt('bf')),
    p_branch_id, p_type_id, p_category_id, p_subject_id,
    p_is_anonymous,
    -- Em manifestação anônima os dados pessoais são descartados aqui, e não
    -- apenas ocultados na interface.
    case when p_is_anonymous then null else p_reporter_name end,
    case when p_is_anonymous then null else p_reporter_tax_id end,
    case when p_is_anonymous then null else p_reporter_email end,
    case when p_is_anonymous then null else p_reporter_phone end,
    case when p_is_anonymous then null else p_reporter_whatsapp end,
    p_description, p_occurred_at, p_occurred_location, p_people_involved,
    p_amount_involved, p_has_witnesses,
    now() + make_interval(days => coalesce(v_settings.default_sla_days, 10))
  )
  returning id into v_occurrence_id;

  insert into occurrence_events (company_id, occurrence_id, actor_label, event_type, description)
  values (v_company.id, v_occurrence_id, 'manifestante', 'registrada', 'Manifestação registrada.');

  return jsonb_build_object(
    'protocol', v_protocol,
    'tracking_code', v_tracking_code,
    'due_at', (select due_at from occurrences where id = v_occurrence_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Consulta por protocolo + código.
-- ---------------------------------------------------------------------------
create or replace function public.track_manifestacao(
  p_company_slug  text,
  p_protocol      text,
  p_tracking_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_occ        occurrences;
  v_company_id uuid;
begin
  select id into v_company_id from companies where slug = p_company_slug and status = 'ativa';
  v_occ := app.resolve_occurrence(v_company_id, p_protocol, p_tracking_code);
  if v_occ.id is null then
    raise exception 'Protocolo ou código de acompanhamento inválido' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'protocol', v_occ.protocol,
    'status', v_occ.status,
    'opened_at', v_occ.opened_at,
    'due_at', v_occ.due_at,
    'answered_at', v_occ.answered_at,
    'closed_at', v_occ.closed_at,
    'is_anonymous', v_occ.is_anonymous,
    'type', (select name from occurrence_types where id = v_occ.type_id),
    'category', (select name from categories where id = v_occ.category_id),
    'subject', (select name from subjects where id = v_occ.subject_id),
    'branch', (select name from branches where id = v_occ.branch_id),
    'description', v_occ.description,
    'answer', v_occ.answer,
    'resolution', v_occ.resolution,
    'can_rate', (
      v_occ.status = 'encerrada'
      and not v_occ.is_anonymous
      and coalesce((select allow_rating from company_settings where company_id = v_occ.company_id), true)
      and not exists (select 1 from occurrence_ratings where occurrence_id = v_occ.id)
    ),
    -- Notas internas nunca saem por aqui.
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'author', m.author,
        'body', m.body,
        'created_at', m.created_at
      ) order by m.created_at)
      from occurrence_messages m
      where m.occurrence_id = v_occ.id and not m.is_internal
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type', e.event_type,
        'description', e.description,
        'created_at', e.created_at
      ) order by e.created_at)
      from occurrence_events e
      where e.occurrence_id = v_occ.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Resposta do manifestante dentro da própria manifestação.
-- ---------------------------------------------------------------------------
create or replace function public.reply_manifestacao(
  p_company_slug  text,
  p_protocol      text,
  p_tracking_code text,
  p_body          text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_occ        occurrences;
  v_company_id uuid;
begin
  if coalesce(btrim(p_body), '') = '' then
    raise exception 'A mensagem não pode ficar em branco' using errcode = 'check_violation';
  end if;

  select id into v_company_id from companies where slug = p_company_slug and status = 'ativa';
  v_occ := app.resolve_occurrence(v_company_id, p_protocol, p_tracking_code);
  if v_occ.id is null then
    raise exception 'Protocolo ou código de acompanhamento inválido' using errcode = 'no_data_found';
  end if;

  if v_occ.status in ('encerrada', 'cancelada', 'descartada') then
    raise exception 'Esta manifestação já foi encerrada' using errcode = 'check_violation';
  end if;

  insert into occurrence_messages (company_id, occurrence_id, author, body)
  values (v_occ.company_id, v_occ.id, 'manifestante', btrim(p_body));

  insert into occurrence_events (company_id, occurrence_id, actor_label, event_type, description)
  values (v_occ.company_id, v_occ.id, 'manifestante', 'mensagem_recebida',
          'Manifestante enviou uma nova mensagem.');

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Avaliação do atendimento, após o encerramento.
-- ---------------------------------------------------------------------------
create or replace function public.rate_manifestacao(
  p_company_slug  text,
  p_protocol      text,
  p_tracking_code text,
  p_stars         smallint,
  p_comment       text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_occ        occurrences;
  v_company_id uuid;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'A avaliação deve ser de 1 a 5 estrelas' using errcode = 'check_violation';
  end if;

  select id into v_company_id from companies where slug = p_company_slug and status = 'ativa';
  v_occ := app.resolve_occurrence(v_company_id, p_protocol, p_tracking_code);
  if v_occ.id is null then
    raise exception 'Protocolo ou código de acompanhamento inválido' using errcode = 'no_data_found';
  end if;

  if v_occ.status <> 'encerrada' then
    raise exception 'A avaliação fica disponível após o encerramento' using errcode = 'check_violation';
  end if;

  -- Conforme a especificação, a avaliação é pedida ao manifestante
  -- identificado. Para liberar também no anônimo, basta remover esta checagem.
  if v_occ.is_anonymous then
    raise exception 'Avaliação disponível apenas para manifestação identificada'
      using errcode = 'check_violation';
  end if;

  if not coalesce((select allow_rating from company_settings where company_id = v_occ.company_id), true) then
    raise exception 'Esta ouvidoria não coleta avaliação' using errcode = 'check_violation';
  end if;

  insert into occurrence_ratings (occurrence_id, company_id, stars, comment)
  values (v_occ.id, v_occ.company_id, p_stars, nullif(btrim(p_comment), ''))
  on conflict (occurrence_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

-- Só estas cinco funções ficam ao alcance do canal público.
revoke all on function app.next_protocol(uuid) from public, anon, authenticated;
revoke all on function app.resolve_occurrence(uuid, text, text) from public, anon, authenticated;

grant execute on function public.get_ouvidoria_channel(text) to anon, authenticated;
grant execute on function public.create_manifestacao(text, text, uuid, uuid, uuid, uuid, boolean, text, text, text, text, text, date, text, text, numeric, boolean) to anon, authenticated;
grant execute on function public.track_manifestacao(text, text, text) to anon, authenticated;
grant execute on function public.reply_manifestacao(text, text, text, text) to anon, authenticated;
grant execute on function public.rate_manifestacao(text, text, text, smallint, text) to anon, authenticated;

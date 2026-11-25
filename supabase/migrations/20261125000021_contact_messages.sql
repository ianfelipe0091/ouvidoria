-- Página "Fale conosco" do site da plataforma.
--
-- Mensagens de quem ainda não é cliente (ou é, mas escreveu pelo site). Não
-- pertencem a nenhum tenant: só o administrador da plataforma lê e trata.
--
-- O envio anônimo passa por uma função SECURITY DEFINER, como o canal de
-- manifestação: o papel `anon` não tem acesso à tabela, e a chave secreta não
-- é usada para atender visitante.

create table contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  email       text not null check (char_length(email) between 5 and 200),
  phone       text check (char_length(phone) <= 40),
  company     text check (char_length(company) <= 160),
  message     text not null check (char_length(message) between 10 and 4000),
  status      text not null default 'nova' check (status in ('nova', 'respondida', 'arquivada')),
  created_at  timestamptz not null default now(),
  handled_at  timestamptz,
  handled_by  uuid references auth.users (id) on delete set null
);

comment on table contact_messages is 'Mensagens do formulário "Fale conosco" do site. Lidas no painel Master.';

create index contact_messages_created_idx on contact_messages (created_at desc);

alter table contact_messages enable row level security;

revoke all on contact_messages from anon;

create policy contact_messages_admin_select on contact_messages
  for select to authenticated
  using (app.is_platform_admin());

create policy contact_messages_admin_update on contact_messages
  for update to authenticated
  using (app.is_platform_admin())
  with check (app.is_platform_admin());

-- ------------------------------------------------------------- envio -------
create or replace function public.submit_contact_message(
  p_name    text,
  p_email   text,
  p_phone   text default null,
  p_company text default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if char_length(coalesce(trim(p_name), '')) < 2 then
    raise exception 'Informe seu nome.' using errcode = '22023';
  end if;
  if coalesce(trim(p_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;
  if char_length(coalesce(trim(p_message), '')) < 10 then
    raise exception 'Escreva a mensagem com pelo menos 10 caracteres.' using errcode = '22023';
  end if;

  insert into contact_messages (name, email, phone, company, message)
  values (
    left(trim(p_name), 120),
    lower(left(trim(p_email), 200)),
    nullif(left(trim(coalesce(p_phone, '')), 40), ''),
    nullif(left(trim(coalesce(p_company, '')), 160), ''),
    left(trim(p_message), 4000)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_contact_message(text, text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------- tratamento -----
create or replace function public.admin_set_contact_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if p_status not in ('nova', 'respondida', 'arquivada') then
    raise exception 'Situação inválida.' using errcode = '22023';
  end if;

  update contact_messages
     set status     = p_status,
         handled_at = case when p_status = 'nova' then null else now() end,
         handled_by = case when p_status = 'nova' then null else auth.uid() end
   where id = p_id;
end;
$$;

revoke all on function public.admin_set_contact_status(uuid, text) from public, anon;
grant execute on function public.admin_set_contact_status(uuid, text) to authenticated;

-- Apelidos reservados do canal público.
--
-- O canal deixou de ficar em /ouvidoria/<empresa> e passou para /<empresa>.
-- Com isso o apelido da empresa divide o mesmo espaço das rotas do sistema: se
-- uma empresa recebesse o apelido "painel", /painel abriria o painel e o canal
-- dela ficaria inacessível. Esta lista barra esses nomes.

create or replace function app.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
as $$
  select lower(p_slug) in (
    -- Rotas de topo hoje existentes.
    'api', 'criar-conta', 'entrar', 'master', 'onboarding', 'painel', 'sair',
    -- Prefixo antigo do canal, ainda redirecionado.
    'ouvidoria',
    -- Convenções do Next.js e arquivos servidos na raiz.
    '_next', 'favicon', 'favicon.ico', 'icon', 'apple-icon', 'robots',
    'robots.txt', 'sitemap', 'sitemap.xml', 'manifest', 'manifest.json',
    'well-known', '.well-known',
    -- Termos que provavelmente virarão páginas do site.
    'sobre', 'contato', 'planos', 'precos', 'termos', 'privacidade', 'ajuda',
    'suporte', 'blog', 'login', 'cadastro', 'conta', 'admin', 'app', 'empresa'
  )
$$;

comment on function app.is_reserved_slug(text) is
  'true quando o apelido colide com uma rota do sistema e não pode ser usado como canal de empresa (/slug).';

-- Trava no banco: garante que nenhum caminho de criação — cadastro, painel da
-- plataforma, script — grave um apelido reservado, independentemente da
-- interface. Os apelidos atuais (demo, viva-digital, ian-felipe) não colidem.
alter table companies
  add constraint companies_slug_not_reserved
  check (not app.is_reserved_slug(slug));

-- O sugeridor de apelido passa a pular os reservados: "Painel Ltda" não vira
-- "painel", vira "painel-2". Mesmo corpo de 20260914000013, só a condição do
-- laço muda.
create or replace function public.suggest_company_slug(p_name text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_base    text;
  v_slug    text;
  v_counter integer := 1;
begin
  v_base := lower(unaccent_fallback(p_name));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  v_base := left(v_base, 40);

  if v_base = '' then v_base := 'empresa'; end if;

  v_slug := v_base;
  while exists (select 1 from companies where slug = v_slug)
        or app.is_reserved_slug(v_slug) loop
    v_counter := v_counter + 1;
    v_slug := v_base || '-' || v_counter::text;
  end loop;

  return v_slug;
end;
$$;

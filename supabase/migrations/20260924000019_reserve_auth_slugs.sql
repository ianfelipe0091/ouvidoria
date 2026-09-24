-- Reserva os apelidos das novas rotas de autenticação por e-mail.
--
-- /auth/confirmar, /esqueci-senha e /redefinir-senha passaram a existir na raiz,
-- que é o mesmo espaço dos apelidos de empresa. Sem reservar, uma empresa
-- poderia receber, por exemplo, o apelido "auth" e ficar inacessível.
-- Mesma função de 20260924000018, com os três nomes novos somados.

create or replace function app.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
as $$
  select lower(p_slug) in (
    'api', 'criar-conta', 'entrar', 'master', 'onboarding', 'painel', 'sair',
    'auth', 'esqueci-senha', 'redefinir-senha',
    'ouvidoria',
    '_next', 'favicon', 'favicon.ico', 'icon', 'apple-icon', 'robots',
    'robots.txt', 'sitemap', 'sitemap.xml', 'manifest', 'manifest.json',
    'well-known', '.well-known',
    'sobre', 'contato', 'planos', 'precos', 'termos', 'privacidade', 'ajuda',
    'suporte', 'blog', 'login', 'cadastro', 'conta', 'admin', 'app', 'empresa'
  )
$$;

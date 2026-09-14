-- Armazenamento de anexos.
--
-- Bucket privado: nenhum arquivo é acessível por URL pública. O acesso se dá
-- por URL assinada, emitida pelo servidor depois de conferir quem pede.
--
-- O caminho do objeto começa sempre pelo company_id:
--   <company_id>/<occurrence_id>/<arquivo>
-- É esse primeiro segmento que as políticas comparam, então um arquivo não
-- pode ser lido de fora do tenant mesmo que alguém descubra o caminho.

insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 10485760)  -- 10 MB, o padrão da plataforma
on conflict (id) do nothing;

-- Empresa do usuário como texto, para comparar com o primeiro segmento do
-- caminho. Separada por ser usada dentro das políticas de storage.
create or replace function app.current_company_folder()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.current_company_id()::text;
$$;

grant execute on function app.current_company_folder() to authenticated;

create policy "anexos: leitura pelo tenant"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'anexos'
    and (
      app.is_platform_admin()
      or (storage.foldername(name))[1] = app.current_company_folder()
    )
  );

create policy "anexos: envio pelo tenant"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] = app.current_company_folder()
  );

create policy "anexos: exclusão pelo tenant"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'anexos'
    and (
      app.is_platform_admin()
      or (storage.foldername(name))[1] = app.current_company_folder()
    )
  );

-- O canal público não recebe policy alguma: o manifestante nunca fala com o
-- Storage diretamente. O envio passa por uma rota do servidor que confere
-- protocolo e código antes de gravar.

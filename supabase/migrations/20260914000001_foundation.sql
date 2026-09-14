-- Fundação: extensões, schema privado e tipos enumerados do domínio.

create extension if not exists pgcrypto with schema extensions;

-- Schema privado para funções auxiliares de autorização.
-- Não é exposto na Data API, então nada aqui vira endpoint REST.
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;

-- Perfis de acesso. A ordem reflete o nível de privilégio.
create type app_role as enum (
  'platform_admin',   -- nível 1: administradora da plataforma (nossa empresa)
  'company_admin',    -- nível 2: administrador da empresa cliente
  'ombudsman',        -- nível 3: ouvidor/operador
  'manager',          -- gestor: indicadores e ocorrências da sua área
  'area_responsible'  -- nível 4: responsável que recebe encaminhamentos
);

-- Ciclo de vida da manifestação.
create type occurrence_status as enum (
  'recebida',
  'em_analise',
  'em_tratamento',
  'aguardando_informacoes',
  'aguardando_resposta',
  'respondida',
  'encerrada',
  'cancelada',
  'descartada'
);

-- Classificação final no encerramento.
create type occurrence_resolution as enum (
  'procedente',
  'improcedente',
  'parcialmente_procedente',
  'nao_conclusivo'
);

create type record_status as enum ('ativo', 'inativo');

create type company_status as enum ('ativa', 'suspensa', 'bloqueada', 'cancelada');

-- Quem escreveu a mensagem dentro de uma ocorrência.
create type message_author as enum ('manifestante', 'operador');

create type task_status as enum ('pendente', 'em_andamento', 'concluida', 'cancelada');

-- Situação do prazo, derivada de due_at. Não é armazenada.
create type sla_state as enum ('no_prazo', 'proximo_vencimento', 'em_atraso', 'concluida');

-- Atualiza updated_at em qualquer tabela que tenha a coluna.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

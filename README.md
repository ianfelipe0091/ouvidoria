# Ouvidoria

Aplicação [Next.js](https://nextjs.org) (App Router, TypeScript, Tailwind CSS)
conectada ao projeto **Supabase "Nossa Ouvidoria"**.

Plataforma de ouvidoria e relacionamento **multiempresa**: cada cliente tem seu
canal público, sua configuração e seu painel, com isolamento garantido por Row
Level Security.

## O que está pronto

**Canal público** — `/ouvidoria/<empresa>`, com identidade visual da empresa:
formulário em etapas, registro anônimo ou identificado, protocolo e código de
acompanhamento, consulta, conversa com a ouvidoria, anexos e avaliação.

**Painel da equipe** — `/painel`: dashboard com contadores e gráficos, lista de
ocorrências com os filtros da especificação, tela de tratamento (triagem,
encaminhamento, mensagens, notas internas, ações internas, anexos, resposta,
encerramento e histórico), além dos cadastros de filiais, usuários, categorias
e configurações.

**Painel da plataforma** — `/master`: visão consolidada de todas as empresas.

Publicação: veja [DEPLOY.md](./DEPLOY.md).

## Começando

```bash
npm install
cp .env.example .env.local   # preencha os valores (veja abaixo)
npm run seed:demo            # cria a empresa "demo" com dados de exemplo
npm run dev
```

- Canal público: <http://localhost:3000/ouvidoria/demo>
- Painel: <http://localhost:3000/entrar>
- Estado da conexão: <http://localhost:3000/api/health>

O `seed:demo` imprime o e-mail, a senha e os protocolos gerados.

## Variáveis de ambiente

Os valores estão no Dashboard do Supabase, em **Project Settings > API Keys**.

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL da API do projeto. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sim | Chave publicável (`sb_publishable_…`). Pode ser exposta ao browser: o acesso aos dados é controlado pelas políticas de RLS. |
| `SUPABASE_SECRET_KEY` | não | Chave secreta (`sb_secret_…`). Ignora RLS. Necessária apenas para `src/lib/supabase/admin.ts`. Nunca versione nem use no browser. |

> **Atenção:** o Next.js substitui as variáveis `NEXT_PUBLIC_*` em tempo de
> **build**, não de execução. Trocar de projeto Supabase exige um novo
> `npm run build` — redefinir a variável só no ambiente de execução não tem
> efeito.

`.env.local` não é versionado. `.env.example` é o modelo versionado.

## Estrutura da conexão

| Arquivo | Papel |
| --- | --- |
| `src/lib/supabase/client.ts` | Cliente para Client Components (`"use client"`). |
| `src/lib/supabase/server.ts` | Cliente para Server Components, Server Actions e Route Handlers. |
| `src/lib/supabase/admin.ts` | Cliente com a chave secreta, exclusivo do servidor (ignora RLS). |
| `src/lib/supabase/proxy.ts` | Renova a sessão a cada requisição. |
| `src/lib/supabase/env.ts` | Leitura validada das variáveis de ambiente. |
| `src/lib/supabase/health.ts` | Checagem de conectividade usada pela home e por `/api/health`. |
| `src/lib/supabase/database.types.ts` | Tipos gerados a partir do schema. **Não edite à mão.** |
| `src/proxy.ts` | Ponto de entrada do proxy do Next.js. |

### Sobre `proxy.ts`

No Next.js 16 a convenção `middleware.ts` foi renomeada para `proxy.ts`, com o
export `proxy` no lugar de `middleware`. O comportamento é o mesmo. A
documentação do Supabase ainda usa o nome antigo — ao segui-la, adapte o nome
do arquivo e do export.

O proxy renova o token de sessão a cada requisição. Sem ele, Server Components
— que não conseguem escrever cookies — ficariam com sessões expiradas e o
usuário seria deslogado sem aviso.

## Modelo de dados

O schema vive em `supabase/migrations/` e está aplicado no projeto remoto.

| Domínio | Tabelas |
| --- | --- |
| Tenancy | `plans`, `companies`, `company_settings`, `branches`, `departments` |
| Identidade | `profiles`, `user_branches` |
| Classificação | `occurrence_types`, `categories`, `subjects` |
| Manifestações | `occurrences`, `occurrence_events`, `occurrence_messages`, `attachments`, `occurrence_tasks`, `occurrence_ratings` |
| Suporte | `protocol_counters`, `audit_logs` |

### Isolamento entre empresas

A regra "uma empresa jamais acessa dados de outra" é sustentada por três
mecanismos independentes, e não apenas pela interface:

1. **RLS em todas as tabelas.** As políticas derivam o tenant do usuário pelas
   funções do schema `app`, que não é exposto na Data API.
2. **Chaves estrangeiras compostas `(id, company_id)`.** O banco recusa uma
   ocorrência da Empresa A que aponte para filial, categoria, departamento ou
   responsável da Empresa B — mesmo que a aplicação tente.
3. **`anon` sem GRANT em tabela alguma.** O canal público só enxerga as cinco
   funções `SECURITY DEFINER` listadas abaixo.

Rode `npm run db:verify` para conferir: o script cria duas empresas
descartáveis, exercita as políticas com JWTs reais e apaga tudo no final.

### Perfis de acesso

| Perfil | Alcance |
| --- | --- |
| `platform_admin` | Toda a plataforma. Único perfil sem empresa. |
| `company_admin` | Tudo dentro da sua empresa. |
| `ombudsman` | Todas as ocorrências da empresa, limitado às filiais permitidas. |
| `manager` | Ocorrências do seu departamento ou atribuídas a ele. |
| `area_responsible` | Apenas o que lhe foi encaminhado. |

O vínculo com filiais fica em `user_branches`. Usuário **sem** vínculo enxerga
todas as filiais da empresa; com vínculo, apenas as listadas.

### Canal público

O manifestante não acessa tabela nenhuma. Todas as chamadas exigem o slug da
empresa, e as três últimas exigem também protocolo + código de acompanhamento:

| Função | Uso |
| --- | --- |
| `get_ouvidoria_channel(slug)` | Identidade visual, textos e opções do formulário. |
| `create_manifestacao(...)` | Registro. Devolve protocolo e código. |
| `track_manifestacao(slug, protocolo, código)` | Consulta. |
| `reply_manifestacao(slug, protocolo, código, texto)` | Resposta do manifestante. |
| `rate_manifestacao(slug, protocolo, código, estrelas, comentário)` | Avaliação. |

> O código de acompanhamento é exibido **uma única vez**, no registro, e
> guardado apenas como hash bcrypt. É o que permite acompanhar uma denúncia
> anônima sem vinculá-la a uma identidade — e, perdido o código, não há
> recuperação.

O protocolo (`OUV-2026-000001`) é sequencial **por empresa**, então o mesmo
número existe em vários tenants. Por isso toda consulta pública é escopada pelo
slug: sem isso, um par protocolo + código resolveria para a ocorrência de outra
empresa.

### Anexos

Ficam num bucket privado do Supabase Storage, em `<company_id>/<occurrence_id>/`.
As políticas comparam o primeiro segmento do caminho com a empresa de quem pede,
então um arquivo não é alcançável de fora do tenant nem com o caminho em mãos.
Não existe link permanente: cada download gera uma URL assinada de 60 segundos.

O manifestante nunca fala com o Storage. O envio pelo canal público passa por
`POST /api/ouvidoria/<slug>/anexos`, que confere protocolo e código antes de
gravar.

### Auditoria

`audit_logs` registra insert, update e delete em `occurrences`,
`occurrence_tasks`, `profiles` e `branches`, guardando apenas os campos que
mudaram. As colunas `company_id` e `actor_id` são `uuid` **sem** chave
estrangeira, de propósito: um registro de auditoria precisa sobreviver à
exclusão daquilo que ele audita.

## Supabase CLI

O projeto já vem com o CLI como dependência de desenvolvimento.

```bash
npx supabase login          # uma vez, por desenvolvedor
npm run db:link             # vincula o repositório ao projeto remoto
npm run db:types            # regenera src/lib/supabase/database.types.ts
```

O vínculo do CLI fica em `supabase/.temp/`, que não é versionado — cada pessoa
roda `npm run db:link` uma vez após clonar.

Rode `npm run db:types` sempre que o schema mudar e versione o resultado.

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento. |
| `npm run build` | Build de produção. |
| `npm run start` | Servidor de produção (exige `build`). |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run db:link` | Vincula o CLI ao projeto Supabase. |
| `npm run db:types` | Regenera os tipos do banco. |
| `npm run db:verify` | Verifica o isolamento multiempresa contra o banco real. |
| `npm run smoke` | Percorre os fluxos ponta a ponta num Chromium real. |
| `scripts/verify-deploy.sh <url>` | Confere um ambiente publicado, sem escrever nada. |
| `npm run seed:demo` | Cria uma empresa de demonstração com dados de exemplo. |
| `npm run admin:create` | Cria o administrador da plataforma (uma vez, por ambiente). |

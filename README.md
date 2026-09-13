# Ouvidoria

Aplicação [Next.js](https://nextjs.org) (App Router, TypeScript, Tailwind CSS)
conectada ao projeto **Supabase "Nossa Ouvidoria"**.

O banco ainda não tem tabelas — este repositório entrega a camada de conexão.

## Começando

```bash
npm install
cp .env.example .env.local   # preencha os valores (veja abaixo)
npm run dev
```

Abra <http://localhost:3000>: a página inicial mostra o status da conexão com o
Supabase. A mesma checagem em JSON fica em <http://localhost:3000/api/health>.

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

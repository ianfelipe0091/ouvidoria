# Publicação

A aplicação é um projeto Next.js padrão e roda em qualquer hospedagem que
execute Node 20+. Estas instruções usam a Vercel, que é o caminho mais direto.

## 1. Variáveis de ambiente

Configure as três na hospedagem, para os ambientes de produção e de preview:

| Variável | Onde encontrar |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase > Project Settings > API Keys > publishable |
| `SUPABASE_SECRET_KEY` | Supabase > Project Settings > API Keys > secret ("reveal") |

> As duas primeiras são substituídas em tempo de **build**. Trocar de projeto
> Supabase exige um novo build — redefinir a variável no ambiente de execução
> não basta.

A chave secreta é usada apenas no servidor, em dois pontos: a criação de contas
de usuário e o recebimento de anexos pelo canal público. Sem ela o restante da
aplicação funciona, mas essas duas operações retornam erro explicativo.

## 2. Deploy

```bash
# com a CLI da Vercel, a partir da raiz do repositório
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_SECRET_KEY production
vercel --prod
```

Pela interface: importe o repositório, informe as três variáveis e publique.
Não há configuração especial de build — `npm run build` é suficiente.

## 3. Configurar a autenticação do Supabase

Em **Supabase > Authentication > URL Configuration**:

- **Site URL**: o domínio publicado (ex.: `https://ouvidoria.suaempresa.com.br`)
- **Redirect URLs**: acrescente o mesmo domínio

Sem isso, os links de e-mail do Auth apontam para `localhost`.

## 4. Criar o administrador da plataforma

Só existe um caminho para isso, e é por script: o administrador da plataforma é
o único perfil sem empresa, então não há de onde convidá-lo pela interface.

```bash
ADMIN_EMAIL=voce@suaempresa.com.br \
ADMIN_PASSWORD='uma senha longa e única' \
node scripts/create-platform-admin.mjs
```

O script recusa criar um segundo administrador se já houver um.

## 5. Primeira empresa cliente

No modelo comercial, quem cadastra é o próprio cliente: basta acessar
`/criar-conta`. O cadastro cria a conta de acesso, provisiona a empresa com
assinatura em avaliação, matriz e taxonomia padrão, e leva ao assistente de
configuração.

Para criar uma conta manualmente (migração, cliente fechado pelo comercial),
use o SQL Editor do Supabase:

```sql
select provision_company(
  p_slug          => 'empresa-exemplo',
  p_legal_name    => 'Empresa Exemplo LTDA',
  p_tax_id        => '00000000000000',
  p_email         => 'contato@exemplo.com.br',
  p_trade_name    => 'Empresa Exemplo',
  p_plan_slug     => 'professional',
  p_admin_user_id => null   -- ou o id de um usuário já criado no Auth
);
```

## 6. Conferir

```bash
scripts/verify-deploy.sh https://seu-dominio   # checagem HTTP do ambiente no ar
npm run db:verify                              # isolamento multiempresa
```

O `verify-deploy.sh` não escreve nada: confere a conexão com o Supabase, se as
rotas privadas exigem sessão, se o canal público recusa anexo sem o código e se
a chave secreta não vazou para o HTML nem para os bundles JavaScript. Pode rodar
contra produção com segurança.

Para o passeio completo num navegador, incluindo registrar e tratar uma
manifestação:

```bash
BASE_URL=https://seu-dominio DEMO_PASSWORD='...' npm run smoke
```

Esse **cria dados reais** — rode contra um ambiente de teste, não contra
produção com dados de clientes. Em redes com proxy de saída, o script repassa
`HTTPS_PROXY` ao navegador automaticamente.

## 7. Ativar a cobrança (opcional)

Sem estas variáveis o produto funciona, mas sem pagamento automático.

1. **Crie os produtos e preços no Stripe**, um preço recorrente mensal em BRL
   por plano. Anote os `price_...`.

2. **Ligue cada preço ao plano** no banco:

   ```sql
   update plans set provider_price_id = 'price_...' where slug = 'basic';
   update plans set provider_price_id = 'price_...' where slug = 'professional';
   update plans set provider_price_id = 'price_...' where slug = 'enterprise';
   ```

   Plano sem `provider_price_id` não é vendável online: o botão avisa e não abre
   o checkout.

3. **Cadastre o webhook** no Stripe apontando para
   `https://seu-dominio/api/webhooks/stripe`, com os eventos:

   ```
   checkout.session.completed
   customer.subscription.created
   customer.subscription.updated
   customer.subscription.deleted
   invoice.finalized
   invoice.paid
   invoice.payment_failed
   ```

   Copie o segredo do endpoint para `STRIPE_WEBHOOK_SECRET`.

4. **Ative o portal de cobrança** em Stripe → Settings → Billing → Customer
   portal. É por ele que o cliente troca o cartão, baixa faturas e cancela —
   guardar dados de cartão no próprio sistema mudaria o nível de conformidade
   exigido de tudo.

5. **Defina `CRON_SECRET`** e confirme que o cron diário está ativo (já
   declarado em `vercel.json`). É ele que suspende quem passou da tolerância.

Para conferir sem mexer em produção:

```bash
STRIPE_WEBHOOK_SECRET=whsec_teste npm run smoke:billing
```

O teste gera assinaturas válidas localmente e percorre todo o ciclo — ativação,
idempotência, inadimplência, bloqueio, retomada e cancelamento.

## 8. Remover os dados de demonstração

Se você rodou `npm run seed:demo` contra o projeto que vai para produção, apague
a empresa de demonstração antes de abrir o canal ao público — ela existe com um
usuário cujo e-mail é previsível:

```sql
-- Apaga a empresa e, em cascata, filiais, usuários, ocorrências e anexos.
delete from companies where slug = 'demo';
```

O usuário do Auth correspondente sai por
**Supabase > Authentication > Users**.

## O que ainda não está pronto para produção

- **Notificações por e-mail.** Nenhum provedor está configurado. Os eventos que
  deveriam disparar e-mail (nova manifestação, encaminhamento, prazo próximo do
  vencimento, nova mensagem, encerramento) já são registrados em
  `occurrence_events`, que é o gancho natural para a integração.
- **Relatórios exportáveis.** A lista de ocorrências cobre a consulta filtrada;
  exportação para Excel, CSV e PDF é da Fase 2.
- **Limite de tentativas.** Nem a consulta por protocolo nem o cadastro de
  empresas têm rate limiting. O cadastro é o mais sensível: é o único ponto em
  que uma requisição anônima aciona a chave secreta, e sem limitador alguém
  pode criar contas em massa. Coloque um limitador na borda antes de divulgar
  o site.
- **Confirmação de e-mail.** O cadastro confirma o e-mail automaticamente,
  porque ainda não há provedor configurado. Com e-mail funcionando, troque
  `email_confirm: true` por um fluxo de confirmação real.
- **Impostos e nota fiscal.** O Stripe emite o recibo da cobrança, não a nota
  fiscal de serviço brasileira. Integrar com um emissor de NFS-e continua
  pendente.
- **Cobrança por PIX e boleto.** O checkout está configurado para cartão. Ambos
  são suportados pelo Stripe no Brasil e exigem habilitação na conta e ajuste
  em `payment_method_types`.
- **Backups.** Confirme a política de backup no plano do Supabase; o plano
  gratuito tem retenção limitada.

## Região: a aplicação roda ao lado do banco

O banco Supabase está em `sa-east-1` (São Paulo), e o `vercel.json` fixa as
funções em `gru1` (São Paulo) por causa disso. Não é preferência: cada tela do
painel faz várias consultas, e com a aplicação em outra região cada uma delas
atravessa o oceano. Com as funções em `iad1` (Virgínia), uma ida ao banco
custava mais de 100 ms; em `gru1`, cerca de 30 ms — e o painel sente isso
multiplicado por consulta.

Se um dia o projeto Supabase mudar de região, a região daqui muda junto. As
duas andam em par.

Para conferir onde uma requisição executou, olhe o cabeçalho `x-vercel-id`:

```
x-vercel-id: gru1::gru1::xxxxx
             ^^^^  ^^^^
             borda  função
```

A primeira parte é a borda que recebeu a requisição — ela varia com a
localização de quem acessa, e vê-la como `iad1` só significa que o teste partiu
dos Estados Unidos. A segunda é onde a função rodou, e precisa ser `gru1`.
`/api/health` também devolve `latencyMs`, medido pelo próprio servidor: é a
forma mais direta de confirmar que a aplicação está perto do banco.

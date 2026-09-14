import type { Metadata } from 'next'

import { LinkButton } from '@/components/ui'
import { PlanGrid, SiteFooter, SiteHeader, type PlanCard } from '@/components/marketing'
import { BRAND } from '@/lib/brand'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
}

export default async function LandingPage() {
  // Os planos vêm do banco, não de uma lista no código: é a mesma tabela que
  // define os limites cobrados, então a página de preços não pode divergir.
  const supabase = await createClient()
  const { data } = await supabase
    .from('plans')
    .select('id, slug, name, description, monthly_price, max_branches, max_users, trial_days, features')
    .eq('is_active', true)
    .eq('is_public', true)
    .order('sort_order')

  const plans = (data ?? []).map((p) => ({
    ...p,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
  })) satisfies PlanCard[]

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 py-16 md:py-24">
          <p className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            Plataforma SaaS · multiempresa
          </p>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
            A ouvidoria da sua empresa, pronta para funcionar hoje.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted">
            {BRAND.description}
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/criar-conta">Criar conta grátis</LinkButton>
            <LinkButton href="/entrar" variant="secondary">Entrar</LinkButton>
          </div>
          <p className="text-xs text-muted">
            Ambiente exclusivo criado na hora. Sem cartão de crédito.
          </p>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-14 md:grid-cols-3">
            <Feature
              title="Canal próprio da sua marca"
              text="Cada empresa recebe um endereço público com seu nome, logo e cores. O cidadão ou colaborador registra em poucos passos, de forma identificada ou anônima."
            />
            <Feature
              title="Do protocolo ao encerramento"
              text="Triagem, encaminhamento por departamento, prazos com alerta de atraso, conversa com o manifestante, anexos e histórico completo de tudo que aconteceu."
            />
            <Feature
              title="Indicadores que a diretoria pede"
              text="Volume por período, tipo, filial e categoria, tempo médio de resposta e manifestações em atraso — sem montar planilha."
            />
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="mb-8 flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Isolamento entre empresas</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Cada cliente enxerga apenas os próprios usuários, filiais, manifestações e
              configurações. A separação é imposta pelo banco de dados, em cada consulta,
              e não apenas escondida na interface.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Feature small title="Regras no banco" text="Políticas por linha decidem o que cada consulta enxerga, qualquer que seja o caminho de acesso." />
            <Feature small title="Chaves compostas" text="Uma manifestação não pode referenciar filial ou responsável de outra empresa: o banco recusa." />
            <Feature small title="Trilha de auditoria" text="Quem alterou, encaminhou, respondeu ou encerrou fica registrado desde o primeiro dia." />
          </div>
        </section>

        <section id="planos" className="border-t border-border bg-surface scroll-mt-16">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <div className="mb-8 flex flex-col gap-2">
              <h2 className="text-xl font-semibold tracking-tight">Planos</h2>
              <p className="text-sm text-muted">
                Todos começam com período de avaliação. Você troca de plano quando quiser.
              </p>
            </div>
            <PlanGrid plans={plans} />
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-6 py-16">
          <h2 className="text-xl font-semibold tracking-tight">
            Comece com o ambiente da sua empresa em poucos minutos
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            O cadastro cria a empresa, a matriz, os tipos de manifestação e as categorias
            padrão. Você ajusta o que quiser no assistente de configuração.
          </p>
          <LinkButton href="/criar-conta">Criar conta grátis</LinkButton>
          <p className="text-xs text-muted">
            É cliente e procura o canal de uma empresa? O endereço tem o formato{' '}
            <code className="rounded bg-surface-muted px-1 py-0.5 font-mono">/ouvidoria/empresa</code>.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function Feature({ title, text, small }: { title: string; text: string; small?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className={small ? 'text-sm font-medium' : 'text-sm font-semibold'}>{title}</h3>
      <p className="text-xs leading-relaxed text-muted">{text}</p>
    </div>
  )
}

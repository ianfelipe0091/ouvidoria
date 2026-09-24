import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

// Imagens importadas (e não referenciadas por string) para que o Next conheça
// largura e altura em tempo de build.
//
// Critério de otimização: o que já chega em tamanho de web (logos, gráfico e
// as fotos JPG de 60–150 KB) vai `unoptimized`, o mesmo arquivo que a
// referência serve — reprocessar só mudaria pixels nas bordas finas. As três
// fontes pesadas (duas fotos de 1920 px e o PNG de 2,5 MB do CTA) passam pelo
// otimizador, que é onde ele economiza de verdade.
import logo from '@/../public/landing/logo.png'
import logoMark from '@/../public/landing/logo-o.png'
import heroWoman from '@/../public/landing/hero-woman.webp'
import heroChart from '@/../public/landing/hero-chart.png'
import isolationWoman from '@/../public/landing/isolation-woman.webp'
import ctaPerson from '@/../public/landing/cta-person.png'
import audienceEmpresas from '@/../public/landing/audience-empresas.jpg'
import audienceFiliais from '@/../public/landing/audience-filiais.jpg'
import audienceFranqueadoras from '@/../public/landing/audience-franqueadoras.jpg'
import audienceHospitais from '@/../public/landing/audience-hospitais.jpg'
import audienceAssociacoes from '@/../public/landing/audience-associacoes.jpg'
import audienceInstituicoes from '@/../public/landing/audience-instituicoes.jpg'
import reason01 from '@/../public/landing/reason-01.jpg'
import reason02 from '@/../public/landing/reason-02.jpg'
import reason03 from '@/../public/landing/reason-03.jpg'
import reason04 from '@/../public/landing/reason-04.jpg'
import reason05 from '@/../public/landing/reason-05.jpg'
import reason06 from '@/../public/landing/reason-06.jpg'
import reason07 from '@/../public/landing/reason-07.jpg'

import { Growth, type Audience } from '@/components/landing/growth'
import { Icon, type IconName } from '@/components/landing/icons'
import { Reasons, type Reason } from '@/components/landing/reasons'
import { BRAND, planLimitLines, salesWhatsappUrl } from '@/lib/brand'
import { createPublicClient } from '@/lib/supabase/public'

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
}

/**
 * A landing é a mesma para todo visitante: sem cookies na consulta de planos,
 * o Next a pré-renderiza no build e serve HTML pronto.
 *
 * Estática de vez, e não com `revalidate`: com revalidação por tempo o Next
 * mantinha aberta a conexão do prefetch desta página, segurando por 30s um
 * dos poucos slots de conexão do navegador. Mudança no catálogo de planos só
 * aparece no próximo deploy — cabe, porque o catálogo vive em migração.
 */
export const revalidate = false

/*
 * Réplica do design de referência (nossa-ouvidoria-website.lovable.app).
 * Estrutura, classes e textos seguem o original elemento a elemento; o que
 * difere é só a origem dos dados (planos do banco) e os links (rotas locais).
 */

const FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'building-2',
    title: 'Canal próprio da sua marca',
    text: 'Cada empresa recebe um endereço público com seu nome, logo e cores. O cidadão ou colaborador registra em poucos passos, de forma identificada ou anônima.',
  },
  {
    icon: 'message-square-text',
    title: 'Do protocolo ao encerramento',
    text: 'Triagem, encaminhamento por departamento, prazos com alerta de atraso, conversa com o manifestante, anexos e histórico completo de tudo que aconteceu.',
  },
  {
    icon: 'clock-3',
    title: 'Indicadores que a diretoria pede',
    text: 'Volume por período, tipo, filial e categoria, tempo médio de resposta e manifestações em atraso — sem montar planilha.',
  },
]

const SAFEGUARDS: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'shield-check',
    title: 'Regras no banco',
    text: 'Políticas por linha decidem o que cada consulta enxerga, qualquer que seja o caminho de acesso.',
  },
  {
    icon: 'lock-keyhole',
    title: 'Chaves compostas',
    text: 'Uma manifestação não pode referenciar filial ou responsável de outra empresa: o banco recusa.',
  },
  {
    icon: 'file-check-corner',
    title: 'Trilha de auditoria',
    text: 'Quem alterou, encaminhou, respondeu ou encerrou fica registrado desde o primeiro dia.',
  },
]

const TAGS = [
  { label: 'Reclamação', color: 'bg-category-orange', pos: 'top-8 left-3', delay: '0s' },
  { label: 'Denúncia', color: 'bg-category-red', pos: 'top-24 right-3', delay: '0.4s' },
  { label: 'Elogio', color: 'bg-category-green', pos: 'top-1/2 left-3', delay: '0.8s' },
  { label: 'Dúvida', color: 'bg-category-blue', pos: 'bottom-24 right-3', delay: '1.2s' },
  { label: 'Crítica', color: 'bg-category-orange', pos: 'bottom-8 left-4', delay: '1.6s' },
]

const REASONS: Reason[] = [
  {
    icon: 'shield-alert',
    title: 'Evite conflitos antes que eles cresçam',
    text: 'A Ouvidoria ajuda a identificar e solucionar problemas antes que se transformem em processos judiciais ou crises.',
    img: reason01,
  },
  {
    icon: 'sparkles',
    title: 'Transforme reclamações em oportunidades',
    text: 'Cada manifestação pode revelar uma falha, um risco ou uma oportunidade de melhorar a experiência.',
    img: reason02,
  },
  {
    icon: 'users',
    title: 'Escute quem faz parte da sua organização',
    text: 'Um canal estruturado demonstra abertura ao diálogo e fortalece a confiança dos seus públicos.',
    img: reason03,
  },
  {
    icon: 'chart-column',
    title: 'Tenha dados para tomar decisões',
    text: 'Dashboards e indicadores transformam manifestações em informações estratégicas para a gestão.',
    img: reason04,
  },
  {
    icon: 'radar',
    title: 'Antecipe riscos',
    text: 'A análise das demandas permite identificar padrões, recorrências e situações que exigem atenção.',
    img: reason05,
  },
  {
    icon: 'award',
    title: 'Fortaleça sua reputação',
    text: 'Organizações que ouvem e dão respostas demonstram compromisso com transparência, responsabilidade e melhoria contínua.',
    img: reason06,
  },
  {
    icon: 'scale',
    title: 'Eleve o nível da sua governança',
    text: 'Uma Ouvidoria estruturada cria um importante mecanismo de escuta, acompanhamento e prestação de contas.',
    img: reason07,
  },
]

const AUDIENCES: Audience[] = [
  {
    title: 'Empresas',
    text: 'Que querem fortalecer a governança, o compliance e a transparência nas relações com colaboradores, clientes e demais públicos.',
    img: audienceEmpresas,
  },
  {
    title: 'Empresas com várias filiais',
    text: 'Que precisam centralizar as manifestações, ter mais controle sobre as unidades e acompanhar de forma organizada as demandas recebidas.',
    img: audienceFiliais,
  },
  {
    title: 'Franqueadoras',
    text: 'Que querem ampliar a transparência da rede, acompanhar manifestações por unidade e fortalecer a relação com franqueados e colaboradores.',
    img: audienceFranqueadoras,
  },
  {
    title: 'Hospitais e laboratórios',
    text: 'Que precisam ouvir pacientes, acompanhantes e colaboradores, aprimorando a experiência e identificando oportunidades de melhoria.',
    img: audienceHospitais,
  },
  {
    title: 'Associações',
    text: 'Que desejam fortalecer o relacionamento com associados, ampliar a transparência e criar um canal estruturado de escuta e participação.',
    img: audienceAssociacoes,
  },
  {
    title: 'Instituições e organizações',
    text: 'Que buscam um canal seguro e organizado para receber manifestações, promover a transparência e transformar a escuta em melhorias.',
    img: audienceInstituicoes,
  },
]

type Plan = {
  slug: string
  name: string
  description: string | null
  price: string
  cents: string
  trialDays: number
  features: string[]
  featured: boolean
  /** false = plano negociado: sem preço de tabela, contratado com o comercial. */
  selfService: boolean
}

export default async function LandingPage() {
  // Os planos vêm do banco, não de uma lista no código: é a mesma tabela que
  // define os limites cobrados, então a página de preços não pode divergir.
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('plans')
    .select('slug, name, description, monthly_price, max_branches, max_users, trial_days, features, self_service')
    .eq('is_active', true)
    .eq('is_public', true)
    .order('sort_order')

  const plans: Plan[] = (data ?? []).map((p) => {
    const [price, cents = '00'] = Number(p.monthly_price).toFixed(2).split('.')
    return {
      slug: p.slug,
      name: p.name,
      description: p.description,
      price,
      cents,
      trialDays: p.trial_days,
      featured: p.slug === 'professional',
      selfService: p.self_service,
      features: [
        ...planLimitLines(p),
        ...(Array.isArray(p.features) ? (p.features as string[]) : []),
      ],
    }
  })
  // Os de contratação imediata ficam na grade de três cartões, como no design
  // de referência; o negociado vem numa faixa larga logo abaixo — um quarto
  // cartão espremeria a grade, e ele não tem preço de tabela para comparar.
  const tablePlans = plans.filter((p) => p.selfService)
  const salesPlans = plans.filter((p) => !p.selfService)

  return (
    <main id="top" className="lp min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
          <Brand />
          <nav className="flex items-center gap-3 text-sm" aria-label="Navegação principal">
            <a
              href="#planos"
              className="hidden px-3 py-2 text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Planos
            </a>
            <Link
              href="/entrar"
              className="hidden px-3 py-2 text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Entrar
            </Link>
            <Link
              href="/criar-conta"
              className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-border bg-hero">
        <div className="mx-auto grid min-h-[610px] max-w-6xl items-center gap-8 px-5 pb-8 pt-14 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:pt-8">
          <div className="relative z-20 max-w-2xl">
            <span className="inline-flex rounded-full border border-primary/15 bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
              Plataforma de Ouvidoria - multiempresa
            </span>
            <h1 className="mt-6 max-w-xl text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-[3.45rem]">
              {'A ouvidoria da sua empresa, pronta para funcionar '}
              <mark className="-my-1 rounded-[6px] bg-primary/80 px-1 py-0 leading-[0.65] text-primary-foreground">
                hoje
              </mark>
              .
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
              Receba, trate e responda manifestações num canal próprio da sua empresa. Reclamações,
              denúncias, sugestões, elogios e solicitações num só lugar, com prazos, indicadores e
              trilha de auditoria.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/criar-conta"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
              >
                Criar conta grátis <Icon name="arrow-right" size={16} />
              </Link>
              <Link
                href="/entrar"
                className="rounded-md border border-border bg-background px-5 py-3 text-sm font-bold transition-colors hover:bg-secondary"
              >
                Entrar
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Ambiente exclusivo criado na hora. Sem cartão de crédito.
            </p>
          </div>

          <div className="relative min-h-[470px] self-end lg:min-h-[540px]">
            <div className="absolute inset-x-12 bottom-0 h-[76%] rounded-[48%_48%_8%_8%] bg-primary-soft" />
            <Image
              src={heroChart}
              alt="Gráfico de distribuição dos relatos por categoria"
              priority
              unoptimized
              className="absolute right-5 top-14 z-10 size-28 object-contain drop-shadow-lg sm:right-10 sm:top-12 sm:size-32 lg:right-3 lg:top-16 lg:size-36"
            />
            <Image
              src={heroWoman}
              alt="Profissional usando o canal de ouvidoria em um tablet"
              priority
              sizes="560px"
              quality={90}
              className="absolute bottom-0 left-1/2 z-20 h-[96%] w-auto max-w-none -translate-x-1/2 object-contain lg:left-[44%]"
            />
            <DashboardCard />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-3 lg:px-8">
          {FEATURES.map((f) => (
            <article key={f.title}>
              <div className="mb-5 grid size-11 place-items-center rounded-lg bg-primary-soft text-primary">
                <Icon name={f.icon} size={21} />
              </div>
              <h2 className="text-base font-bold">{f.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-secondary py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div className="relative mx-auto h-[460px] w-full max-w-[470px]">
            <div className="absolute inset-x-8 bottom-0 h-[88%] rounded-t-[48%] bg-primary-soft" />
            {TAGS.map((t) => (
              <span
                key={t.label}
                className={`absolute z-30 flex items-center gap-1.5 rounded-full ${t.color} px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-black/10 ${t.pos}`}
                style={{ animation: 'tag-float 3s ease-in-out infinite', animationDelay: t.delay }}
              >
                <span className="size-2 rounded-full bg-white/70" />
                {t.label}
              </span>
            ))}
            <Image
              src={isolationWoman}
              alt="Profissional gerenciando manifestações no notebook"
              sizes="480px"
              quality={90}
              className="absolute bottom-0 left-1/2 z-20 h-full w-auto max-w-none -translate-x-1/2 object-contain"
            />
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-primary">Segurança em cada consulta</span>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              Isolamento entre empresas e reclamantes
            </h2>
            <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">
              Cada cliente enxerga apenas os próprios usuários, filiais, manifestações e
              configurações. A separação é imposta pelo banco de dados, em cada consulta, e não
              apenas escondida na interface.
            </p>
            <div className="mt-9 grid gap-4 sm:grid-cols-3">
              {SAFEGUARDS.map((s) => (
                <article key={s.title} className="rounded-lg border border-border bg-background p-5">
                  <Icon name={s.icon} size={22} className="text-primary" />
                  <h3 className="mt-4 text-sm font-bold">{s.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{s.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Reasons reasons={REASONS} />
      <Growth audiences={AUDIENCES} />

      <section id="planos" className="py-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase text-primary">Escolha com tranquilidade</span>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Planos</h2>
            <p className="mt-4 text-muted-foreground">
              Todos começam com período de avaliação. Você troca de plano quando quiser.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {tablePlans.map((plan) => (
              <article
                key={plan.slug}
                className={`relative flex flex-col rounded-xl border p-7 ${plan.featured ? 'border-primary bg-primary text-primary-foreground shadow-xl shadow-primary/15' : 'border-border bg-card'}`}
              >
                {plan.featured ? (
                  <span className="absolute right-5 top-5 rounded-full bg-highlight px-3 py-1 text-[10px] font-extrabold uppercase text-highlight-foreground">
                    Mais contratado
                  </span>
                ) : null}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p
                  className={`mt-3 min-h-12 text-sm leading-6 ${plan.featured ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}
                >
                  {plan.description}
                </p>
                <p className="mt-7">
                  <span className="text-sm">R$ </span>
                  <strong className="text-4xl">{plan.price}</strong>
                  <span className={plan.featured ? 'text-primary-foreground/70' : 'text-muted-foreground'}>
                    {`,${plan.cents}/mês`}
                  </span>
                </p>
                <ul className="my-8 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Icon
                        name="check"
                        size={16}
                        className={plan.featured ? 'text-highlight' : 'text-success'}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/criar-conta?plano=${plan.slug}`}
                  className={`mt-auto rounded-md px-4 py-3 text-center text-sm font-bold transition-transform hover:-translate-y-0.5 ${plan.featured ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground'}`}
                >
                  Testar {plan.trialDays} dias grátis
                </Link>
              </article>
            ))}
          </div>
          {salesPlans.map((plan) => {
            const href = salesWhatsappUrl(plan.name)
            return (
              <article
                key={plan.slug}
                className="mt-6 grid gap-8 rounded-xl border border-border bg-hero p-7 xl:grid-cols-[1fr_2fr_auto] xl:items-center"
              >
                <div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{plan.description}</p>
                  <p className="mt-5">
                    <strong className="text-2xl">Valor personalizado</strong>
                  </p>
                </div>
                <ul className="grid gap-3 text-sm sm:grid-cols-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Icon name="check" size={16} className="shrink-0 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {/* Sem número configurado (BRAND.salesWhatsapp) o botão aparece,
                    mas sem destino: <a> sem href não navega nem recebe foco. */}
                <a
                  href={href ?? undefined}
                  target={href ? '_blank' : undefined}
                  rel={href ? 'noopener noreferrer' : undefined}
                  aria-disabled={href ? undefined : true}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold whitespace-nowrap text-primary-foreground transition-transform hover:-translate-y-0.5 sm:justify-self-start"
                >
                  Falar com especialista <Icon name="message-circle" size={16} />
                </a>
              </article>
            )
          })}
        </div>
      </section>

      <section className="relative overflow-visible bg-foreground text-background">
        <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
          <div className="relative flex justify-center lg:absolute lg:inset-y-0 lg:left-0 lg:flex lg:items-end lg:justify-start">
            <Image
              src={logoMark}
              alt=""
              aria-hidden="true"
              unoptimized
              className="absolute left-1/2 top-1/2 z-0 size-[200px] object-contain opacity-30 sm:size-[280px] lg:left-1/2 lg:size-[340px]"
              style={{ transform: 'translateX(calc(-50% + 100px)) translateY(-50%)' }}
            />
            <Image
              src={ctaPerson}
              alt="Pessoa usando o canal de ouvidoria no celular"
              sizes="(min-width: 1024px) 420px, 280px"
              quality={90}
              className="relative z-10 h-[280px] w-auto object-contain object-bottom sm:h-[360px] lg:h-full lg:w-auto lg:max-w-none"
            />
          </div>
          <div className="max-w-2xl py-16 lg:ml-auto lg:py-24">
            <h2 className="text-3xl font-extrabold">
              Comece com o ambiente da sua empresa em poucos minutos
            </h2>
            <p className="mt-4 leading-7 text-background/70">
              O cadastro cria a empresa, a matriz, os tipos de manifestação e as categorias padrão.
              Você ajusta o que quiser no assistente de configuração.
            </p>
            <Link
              href="/criar-conta"
              className="mt-8 inline-flex shrink-0 items-center gap-2 rounded-md bg-highlight px-6 py-3 font-bold text-highlight-foreground transition-transform hover:-translate-y-0.5"
            >
              Criar conta grátis <Icon name="arrow-right" size={17} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-7">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 px-5 text-xs text-muted-foreground sm:flex-row lg:px-8">
          <Brand />
          <p>
            {'É cliente e procura o canal de uma empresa? O endereço tem o formato '}
            <code className="text-foreground">/empresa</code>.
          </p>
        </div>
      </footer>
    </main>
  )
}

function Brand() {
  return (
    <a href="#top" className="flex items-center" aria-label="Nossa Ouvidoria, início">
      <Image src={logo} alt="Nossa Ouvidoria" priority unoptimized className="h-9 w-auto" />
    </a>
  )
}

/** Cartão de vidro sobre a foto do hero, imitando o painel de manifestações. */
function DashboardCard() {
  return (
    <div className="absolute bottom-8 right-4 z-30 w-[82%] max-w-[380px] origin-bottom-right scale-[0.8] overflow-hidden rounded-xl border border-white/40 bg-white/10 shadow-2xl backdrop-blur-xl">
      <div className="flex h-9 items-center gap-1.5 border-b border-white/20 px-4">
        <span className="size-2 rounded-full bg-category-red" />
        <span className="size-2 rounded-full bg-category-orange" />
        <span className="size-2 rounded-full bg-category-green" />
        <span className="ml-3 text-[10px] font-semibold text-muted-foreground">Painel de manifestações</span>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[9px] uppercase text-muted-foreground">Visão geral</p>
            <p className="text-sm font-bold">Olá, equipe de Ouvidoria</p>
          </div>
          <span className="rounded-full border border-success/30 bg-success/20 px-2 py-1 text-[9px] font-bold text-success">
            12 no prazo
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            ['Reclamação', '32', 'bg-category-red'],
            ['Denúncia', '18', 'bg-category-orange'],
            ['Solicitação', '27', 'bg-category-blue'],
            ['Elogio', '14', 'bg-category-green'],
          ].map(([label, value, dot]) => (
            <div key={label} className="rounded-md border border-white/20 bg-white/10 p-2">
              <span className={`mb-2 block size-2 rounded-full ${dot}`} />
              <strong className="block text-base">{value}</strong>
              <span className="text-[8px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-3">
          <div className="rounded-md border border-white/20 bg-white/10 p-3">
            <div className="flex h-16 items-end gap-2">
              {['h-7', 'h-11', 'h-6', 'h-14', 'h-10', 'h-16', 'h-12'].map((h, i) => (
                <span key={i} className={`flex-1 rounded-t-sm bg-primary/80 ${h}`} />
              ))}
            </div>
            <p className="mt-2 text-[8px] text-muted-foreground">Manifestações por período</p>
          </div>
          <div className="grid place-items-center rounded-md border border-white/20 bg-primary/20 p-3 text-center text-primary-foreground backdrop-blur-sm">
            <strong className="text-2xl">91%</strong>
            <span className="text-[8px] opacity-80">respondidas no prazo</span>
          </div>
        </div>
      </div>
    </div>
  )
}

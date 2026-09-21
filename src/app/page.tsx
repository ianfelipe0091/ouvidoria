import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

// Imagens importadas (e não referenciadas por string) para que o Next conheça
// largura e altura em tempo de build: evita o pulo de layout ao carregar e
// permite gerar as versões reduzidas e em AVIF/WebP.
import logo from '@/../public/landing/logo.png'
import heroWoman from '@/../public/landing/hero-woman.webp'
import heroChart from '@/../public/landing/hero-chart.png'
import isolationWoman from '@/../public/landing/isolation-woman.webp'
import ctaPerson from '@/../public/landing/cta-person.webp'
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
import { Reasons, type Reason } from '@/components/landing/reasons'
import { BRAND, formatMoney } from '@/lib/brand'
import { createPublicClient } from '@/lib/supabase/public'

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
}

/**
 * A landing não tem nada por visitante: é a mesma página para todo mundo. Sem
 * cookies na consulta de planos, o Next a pré-renderiza e a serve do cache,
 * revalidando de hora em hora — é a diferença entre servir um HTML pronto e
 * montar a página (com ida ao banco) a cada visita.
 */
export const revalidate = 3600

// Públicos-alvo do carrossel "cresce com você". Texto e imagens fiéis à referência.
const AUDIENCES: Audience[] = [
  {
    title: 'Empresas',
    desc: 'Que querem fortalecer a governança, o compliance e a transparência nas relações com colaboradores, clientes e demais públicos.',
    img: audienceEmpresas,
  },
  {
    title: 'Empresas com várias filiais',
    desc: 'Que precisam centralizar as manifestações, ter mais controle sobre as unidades e acompanhar de forma organizada as demandas recebidas.',
    img: audienceFiliais,
  },
  {
    title: 'Franqueadoras',
    desc: 'Que querem ampliar a transparência da rede, acompanhar manifestações por unidade e fortalecer a relação com franqueados e colaboradores.',
    img: audienceFranqueadoras,
  },
  {
    title: 'Hospitais e laboratórios',
    desc: 'Que precisam ouvir pacientes, acompanhantes e colaboradores, aprimorando a experiência e identificando oportunidades de melhoria.',
    img: audienceHospitais,
  },
  {
    title: 'Associações',
    desc: 'Que desejam fortalecer o relacionamento com associados, ampliar a transparência e criar um canal estruturado de escuta e participação.',
    img: audienceAssociacoes,
  },
  {
    title: 'Instituições e organizações',
    desc: 'Que buscam um canal seguro e organizado para receber manifestações, promover a transparência e transformar a escuta em melhorias.',
    img: audienceInstituicoes,
  },
]

// Motivos 01–07 da seção escura. Texto fiel à referência.
const REASONS: Reason[] = [
  {
    label: '01',
    short: 'Evite conflitos antes que eles cresçam',
    head: 'Evite conflitos antes que eles cresçam',
    desc: 'A Ouvidoria ajuda a identificar e solucionar problemas antes que se transformem em processos judiciais ou crises.',
    img: reason01,
  },
  {
    label: '02',
    short: 'Transforme reclamações em oportunidades',
    head: 'Transforme reclamações em oportunidades',
    desc: 'Cada manifestação pode revelar uma falha, um risco ou uma oportunidade de melhorar a experiência.',
    img: reason02,
  },
  {
    label: '03',
    short: 'Escute quem faz parte da sua organização',
    head: 'Escute quem faz parte da sua organização',
    desc: 'Um canal estruturado demonstra abertura ao diálogo e fortalece a confiança dos seus públicos.',
    img: reason03,
  },
  {
    label: '04',
    short: 'Tenha dados para tomar decisões',
    head: 'Tenha dados para tomar decisões',
    desc: 'Dashboards e indicadores transformam manifestações em informações estratégicas para a gestão.',
    img: reason04,
  },
  {
    label: '05',
    short: 'Antecipe riscos',
    head: 'Antecipe riscos',
    desc: 'A análise das demandas permite identificar padrões, recorrências e situações que exigem atenção.',
    img: reason05,
  },
  {
    label: '06',
    short: 'Fortaleça sua reputação',
    head: 'Fortaleça sua reputação',
    desc: 'Organizações que ouvem e dão respostas demonstram compromisso com transparência, responsabilidade e melhoria contínua.',
    img: reason06,
  },
  {
    label: '07',
    short: 'Eleve o nível da sua governança',
    head: 'Eleve o nível da sua governança',
    desc: 'Uma Ouvidoria estruturada cria um importante mecanismo de escuta, acompanhamento e prestação de contas.',
    img: reason07,
  },
]

export default async function LandingPage() {
  // Os planos vêm do banco, não de uma lista no código: é a mesma tabela que
  // define os limites cobrados, então a página de preços não pode divergir.
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('plans')
    .select('id, slug, name, description, monthly_price, max_branches, max_users, trial_days, features')
    .eq('is_active', true)
    .eq('is_public', true)
    .order('sort_order')

  const plans = (data ?? []).map((p) => ({
    ...p,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
  }))

  return (
    <div className="lp flex min-h-full flex-1 flex-col">
      <LandingHeader />

      <main className="flex-1">
        <Hero />
        <Features />
        <Isolation />
        <Reasons reasons={REASONS} />
        <Growth audiences={AUDIENCES} />
        <Plans plans={plans} />
        <FinalCta />
      </main>

      <LandingFooter />
    </div>
  )
}

/* ------------------------------------------------------------------ header */

function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--lp-border)] bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" aria-label={BRAND.name} className="flex items-center">
          <Image src={logo} alt={BRAND.name} priority className="h-8 w-auto" />
        </Link>
        <nav className="flex items-center gap-1 text-sm md:gap-2">
          <Link
            href="/#planos"
            className="rounded-lg px-3 py-2 font-medium text-[var(--lp-fg)] hover:text-[var(--lp-primary)]"
          >
            Planos
          </Link>
          <Link
            href="/entrar"
            className="rounded-lg px-3 py-2 font-medium text-[var(--lp-fg)] hover:text-[var(--lp-primary)]"
          >
            Entrar
          </Link>
          <PrimaryLink href="/criar-conta">Criar conta</PrimaryLink>
        </nav>
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="bg-[var(--lp-hero)]">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 md:py-24 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-6">
          <span className="rounded-full border border-[var(--lp-primary)]/25 bg-[var(--lp-primary-soft)] px-4 py-1.5 text-sm font-semibold text-[var(--lp-primary)]">
            Plataforma de Ouvidoria - multiempresa
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            A ouvidoria da sua empresa, pronta para funcionar{' '}
            <span className="mt-2 inline-block rounded-lg bg-[var(--lp-primary)] px-3 py-0.5 text-white">
              hoje
            </span>
            .
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-[var(--lp-muted)] md:text-lg">
            Receba, trate e responda manifestações num canal próprio da sua empresa.
            Reclamações, denúncias, sugestões, elogios e solicitações num só lugar, com
            prazos, indicadores e trilha de auditoria.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <PrimaryLink href="/criar-conta" size="lg">
              Criar conta grátis
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </PrimaryLink>
            <Link
              href="/entrar"
              className="rounded-md border border-[var(--lp-border)] bg-white px-6 py-3 text-sm font-semibold text-[var(--lp-fg)] transition hover:bg-[var(--lp-soft)]"
            >
              Entrar
            </Link>
          </div>
          <p className="text-sm text-[var(--lp-muted)]">
            Ambiente exclusivo criado na hora. Sem cartão de crédito.
          </p>
        </div>

        <HeroArt />
      </div>
    </section>
  )
}

function HeroArt() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      {/* Blob suave atrás da pessoa */}
      <div className="absolute inset-0 translate-x-6 translate-y-6 rounded-[40%_60%_60%_40%/50%_50%_50%_50%] bg-[var(--lp-primary)]/10" />

      <Image
        src={heroWoman}
        alt="Profissional usando a plataforma"
        priority
        sizes="(min-width: 1024px) 512px, 100vw"
        className="relative z-10 w-full"
      />

      {/* Donut decorativo no canto superior */}
      <Image
        src={heroChart}
        alt=""
        priority
        sizes="128px"
        className="absolute -right-2 top-6 z-20 w-28 md:w-32"
      />

      {/* Cartão flutuante do painel */}
      <div className="absolute -bottom-2 right-0 z-20 w-[70%] max-w-[340px] rounded-xl border border-white/60 bg-[var(--lp-dark)]/85 p-3 text-white shadow-2xl backdrop-blur">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#ef4444]" />
          <span className="size-2 rounded-full bg-[#f59e0b]" />
          <span className="size-2 rounded-full bg-[#22c55e]" />
          <span className="ml-2 text-[10px] text-white/60">Painel de manifestações</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-semibold">Olá, equipe de Ouvidoria</span>
          <span className="rounded-full bg-[#22c55e]/20 px-2 py-0.5 text-[9px] font-semibold text-[#4ade80]">
            12 no prazo
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[
            { n: 32, l: 'Reclamação', c: '#ef4444' },
            { n: 18, l: 'Denúncia', c: '#f59e0b' },
            { n: 27, l: 'Solicitação', c: '#3b82f6' },
            { n: 14, l: 'Elogio', c: '#22c55e' },
          ].map((s) => (
            <div key={s.l} className="rounded-md bg-white/5 p-1.5">
              <span className="size-1.5 rounded-full" style={{ background: s.c, display: 'inline-block' }} />
              <p className="text-sm font-bold leading-tight">{s.n}</p>
              <p className="text-[8px] text-white/50">{s.l}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <div className="col-span-2 rounded-md bg-white/5 p-2">
            <p className="mb-1 text-[8px] text-white/50">Manifestações por período</p>
            <div className="flex h-10 items-end gap-1">
              {[40, 55, 35, 70, 50, 85, 60].map((h, i) => (
                <span key={i} className="flex-1 rounded-sm bg-[var(--lp-primary)]" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-md bg-[var(--lp-primary)]/20 p-2">
            <p className="text-lg font-extrabold leading-none">91%</p>
            <p className="text-[8px] text-white/60">respondidas no prazo</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- features */

function Features() {
  const items = [
    {
      icon: <IconBuilding />,
      title: 'Canal próprio da sua marca',
      text: 'Cada empresa recebe um endereço público com seu nome, logo e cores. O cidadão ou colaborador registra em poucos passos, de forma identificada ou anônima.',
    },
    {
      icon: <IconChat />,
      title: 'Do protocolo ao encerramento',
      text: 'Triagem, encaminhamento por departamento, prazos com alerta de atraso, conversa com o manifestante, anexos e histórico completo de tudo que aconteceu.',
    },
    {
      icon: <IconClock />,
      title: 'Indicadores que a diretoria pede',
      text: 'Volume por período, tipo, filial e categoria, tempo médio de resposta e manifestações em atraso — sem montar planilha.',
    },
  ]
  return (
    <section className="bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 md:grid-cols-3 md:py-20">
        {items.map((it) => (
          <div key={it.title} className="flex flex-col gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--lp-primary-soft)] text-[var(--lp-primary)]">
              {it.icon}
            </span>
            <h3 className="text-lg font-bold">{it.title}</h3>
            <p className="text-sm leading-relaxed text-[var(--lp-muted)]">{it.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- isolation */

function Isolation() {
  const cards = [
    {
      icon: <IconShield />,
      title: 'Regras no banco',
      text: 'Políticas por linha decidem o que cada consulta enxerga, qualquer que seja o caminho de acesso.',
    },
    {
      icon: <IconLock />,
      title: 'Chaves compostas',
      text: 'Uma manifestação não pode referenciar filial ou responsável de outra empresa: o banco recusa.',
    },
    {
      icon: <IconDoc />,
      title: 'Trilha de auditoria',
      text: 'Quem alterou, encaminhou, respondeu ou encerrou fica registrado desde o primeiro dia.',
    },
  ]
  const pills = [
    { label: 'Reclamação', c: 'var(--lp-gold)', pos: 'left-2 top-8' },
    { label: 'Denúncia', c: '#ef4444', pos: 'right-4 top-16' },
    { label: 'Elogio', c: '#22c55e', pos: 'left-0 top-44' },
    { label: 'Dúvida', c: 'var(--lp-primary)', pos: 'right-2 top-56' },
    { label: 'Crítica', c: 'var(--lp-gold)', pos: 'left-8 bottom-6' },
  ]
  return (
    <section className="bg-[var(--lp-soft)]">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 md:py-20 lg:grid-cols-2">
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-3xl bg-[var(--lp-primary)]/10" />
          <Image
            src={isolationWoman}
            alt="Profissional consultando manifestações"
            sizes="(min-width: 1024px) 448px, 100vw"
            placeholder="blur"
            className="relative z-10 w-full rounded-3xl object-cover"
          />
          {pills.map((p) => (
            <span
              key={p.label}
              className={`absolute z-20 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-lg ${p.pos}`}
              style={{ background: p.c }}
            >
              {p.label}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--lp-primary)]">
            SEGURANÇA EM CADA CONSULTA
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight md:text-4xl">
            Isolamento entre empresas e reclamantes
          </h2>
          <p className="text-sm leading-relaxed text-[var(--lp-muted)] md:text-base">
            Cada cliente enxerga apenas os próprios usuários, filiais, manifestações e
            configurações. A separação é imposta pelo banco de dados, em cada consulta, e
            não apenas escondida na interface.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {cards.map((c) => (
              <div
                key={c.title}
                className="flex flex-col gap-2 rounded-xl border border-[var(--lp-border)] bg-white p-4"
              >
                <span className="text-[var(--lp-primary)]">{c.icon}</span>
                <h3 className="text-sm font-bold">{c.title}</h3>
                <p className="text-xs leading-relaxed text-[var(--lp-muted)]">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------- plans */

function Plans({ plans }: { plans: Array<{
  id: string; slug: string; name: string; description: string | null
  monthly_price: string | number; max_branches: number | null; max_users: number | null
  trial_days: number; features: string[]
}> }) {
  return (
    <section id="planos" className="scroll-mt-20 bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--lp-primary)]">
          ESCOLHA COM TRANQUILIDADE
        </p>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight md:text-4xl">Planos</h2>
        <p className="mt-4 max-w-2xl text-sm text-[var(--lp-muted)] md:text-base">
          Todos começam com período de avaliação. Você troca de plano quando quiser.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan, index) => {
            const featured = index === 1
            const branches =
              plan.max_branches === null
                ? 'Filiais ilimitadas'
                : `Até ${plan.max_branches} ${plan.max_branches === 1 ? 'filial' : 'filiais'}`
            const users =
              plan.max_users === null ? 'Usuários ilimitados' : `Até ${plan.max_users} usuários`
            const features = [branches, users, ...plan.features]

            return (
              <div
                key={plan.id}
                className={[
                  'relative flex flex-col rounded-2xl border p-6',
                  featured
                    ? 'border-[var(--lp-primary)] bg-[var(--lp-primary)] text-white shadow-xl md:-translate-y-3'
                    : 'border-[var(--lp-border)] bg-white',
                ].join(' ')}
              >
                {featured ? (
                  <span className="absolute -top-3 right-6 rounded-full bg-[var(--lp-gold)] px-3 py-1 text-[10px] font-bold tracking-wide text-[var(--lp-dark)]">
                    MAIS CONTRATADO
                  </span>
                ) : null}

                <h3 className={`text-lg font-bold ${featured ? 'text-white' : ''}`}>{plan.name}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${featured ? 'text-white/80' : 'text-[var(--lp-muted)]'}`}>
                  {plan.description}
                </p>

                <p className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {formatMoney(plan.monthly_price)}
                  </span>
                  <span className={`text-sm ${featured ? 'text-white/70' : 'text-[var(--lp-muted)]'}`}>/mês</span>
                </p>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckMark featured={featured} />
                      <span className={featured ? 'text-white/90' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/criar-conta?plano=${plan.slug}`}
                  className={[
                    'mt-6 rounded-md px-5 py-3 text-center text-sm font-semibold transition',
                    featured
                      ? 'bg-white text-[var(--lp-primary)] hover:bg-white/90'
                      : 'bg-[var(--lp-primary)] text-white hover:bg-[var(--lp-primary-hover)]',
                  ].join(' ')}
                >
                  Testar {plan.trial_days} dias grátis
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- final cta */

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[var(--lp-dark)] text-white">
      {/* "Q" decorativo de marca-d'água */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/4 select-none text-[24rem] font-extrabold leading-none text-white/[0.03]"
      >
        Q
      </span>
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 md:py-20 lg:grid-cols-[0.8fr_1fr]">
        <div className="relative mx-auto w-full max-w-xs">
          <Image
            src={ctaPerson}
            alt=""
            sizes="(min-width: 1024px) 320px, 100vw"
            placeholder="blur"
            className="relative z-10 w-full"
          />
        </div>
        <div className="flex flex-col items-start gap-5">
          <h2 className="text-2xl font-extrabold tracking-tight md:text-4xl">
            Comece com o ambiente da sua empresa em poucos minutos
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
            O cadastro cria a empresa, a matriz, os tipos de manifestação e as categorias
            padrão. Você ajusta o que quiser no assistente de configuração.
          </p>
          <Link
            href="/criar-conta"
            className="rounded-md bg-[var(--lp-gold)] px-6 py-3 text-sm font-bold text-[var(--lp-dark)] transition hover:bg-[var(--lp-gold-hover)]"
          >
            Criar conta grátis
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ footer */

function LandingFooter() {
  return (
    <footer className="border-t border-[var(--lp-border)] bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
        <Image src={logo} alt={BRAND.name} className="h-7 w-auto" />
        <p className="max-w-md text-xs leading-relaxed text-[var(--lp-muted)]">
          É cliente e procura o canal de uma empresa? O endereço tem o formato{' '}
          <code className="rounded bg-[var(--lp-soft)] px-1 py-0.5 font-mono">/ouvidoria/empresa</code>.
        </p>
      </div>
    </footer>
  )
}

/* --------------------------------------------------------------- primitives */

function PrimaryLink({
  href, children, size = 'md',
}: {
  href: string
  children: React.ReactNode
  size?: 'md' | 'lg'
}) {
  return (
    <Link
      href={href}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md bg-[var(--lp-primary)] font-semibold text-white transition hover:bg-[var(--lp-primary-hover)]',
        size === 'lg' ? 'px-6 py-3 text-sm' : 'px-4 py-2 text-sm',
      ].join(' ')}
    >
      {children}
    </Link>
  )
}

function CheckMark({ featured }: { featured?: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      className={`mt-0.5 shrink-0 ${featured ? 'text-white' : 'text-[var(--lp-primary)]'}`}
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* icons ---------------------------------------------------------------- */

function IconBuilding() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 21h18M6 21V5a1 1 0 011-1h6a1 1 0 011 1v16M14 21V9h3a1 1 0 011 1v11M9 8h2M9 12h2M9 16h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconChat() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconClock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function IconDoc() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h7l5 5v13a0 0 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

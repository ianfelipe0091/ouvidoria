import Link from 'next/link'

import { Icon, type IconName } from '@/components/landing/icons'
import { getChannel } from '@/lib/channel'

const STEPS: Array<{ title: string; text: string }> = [
  { title: 'Conte o que aconteceu', text: 'Descreva com suas palavras. Leva poucos minutos e dá para anexar arquivos.' },
  { title: 'Guarde o protocolo', text: 'Ao final você recebe um protocolo e um código de acompanhamento.' },
  { title: 'Acompanhe a resposta', text: 'Consulte o andamento quando quiser e converse com a ouvidoria.' },
]

export default async function ChannelHome(props: PageProps<'/[slug]'>) {
  const { slug } = await props.params
  const channel = await getChannel(slug)
  const anonymous = channel.options.allow_anonymous

  const trust: Array<{ icon: IconName; label: string }> = [
    { icon: 'lock-keyhole', label: 'Tratamento sigiloso' },
    ...(anonymous ? [{ icon: 'eye-off' as const, label: 'Pode ser anônimo' }] : []),
    { icon: 'file-check-corner', label: 'Acompanhamento por protocolo' },
  ]

  return (
    <main>
      {/* ------------------------------------------------------------ topo */}
      <section className="border-b border-border bg-accent-soft">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 pt-12 pb-24 sm:pt-16 sm:pb-28">
          <p className="text-xs font-semibold tracking-wide text-accent uppercase">Ouvidoria</p>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Fale com a ouvidoria da {channel.company.name}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            {channel.branding.intro_text ??
              'Um espaço seguro para registrar reclamações, denúncias, sugestões, elogios e solicitações. Toda manifestação é recebida, tratada com sigilo e respondida.'}
          </p>
          <ul className="flex flex-wrap gap-2">
            {trust.map((t) => (
              <li
                key={t.label}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium"
              >
                <Icon name={t.icon} size={14} className="text-accent" />
                {t.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-5 py-10 sm:py-12">
        {/* ------------------------------------------------------ ações */}
        <div className="-mt-20 grid gap-4 sm:-mt-24 sm:grid-cols-2">
          <ActionCard
            href={`/${slug}/registrar`}
            icon="message-square-text"
            title="Registrar manifestação"
            text="Conte o que aconteceu. Ao final você recebe um protocolo e um código para acompanhar."
            cta="Registrar agora"
            primary
          />
          <ActionCard
            href={`/${slug}/consultar`}
            icon="search"
            title="Consultar manifestação"
            text="Já registrou? Use o protocolo e o código para ver o andamento e conversar com a ouvidoria."
            cta="Consultar andamento"
          />
        </div>

        {/* ---------------------------------------------- o que registrar */}
        {channel.types.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">O que você pode registrar</h2>
            <ul className="flex flex-wrap gap-2">
              {channel.types.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/${slug}/registrar`}
                    className="inline-flex rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
                  >
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* -------------------------------------------------- como funciona */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold">Como funciona</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3 rounded-2xl border border-border bg-surface p-5">
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {anonymous ? (
          <section className="flex gap-3 rounded-2xl border border-border bg-surface p-5">
            <Icon name="shield-check" size={20} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-sm leading-relaxed text-muted">
              Você pode registrar <strong className="font-medium text-foreground">de forma anônima</strong>.
              Nesse caso nenhum dado pessoal é solicitado ou armazenado — o acompanhamento é feito apenas pelo
              protocolo e pelo código.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  )
}

function ActionCard({
  href, icon, title, text, cta, primary = false,
}: {
  href: string
  icon: IconName
  title: string
  text: string
  cta: string
  primary?: boolean
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
    >
      <span
        aria-hidden
        className={`grid size-11 place-items-center rounded-xl ${
          primary ? 'bg-accent text-accent-foreground' : 'bg-accent-soft text-accent'
        }`}
      >
        <Icon name={icon} size={22} />
      </span>
      <div className="flex-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
      </div>
      <span className="flex items-center gap-1.5 text-sm font-semibold text-accent">
        {cta}
        <Icon name="arrow-right" size={16} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

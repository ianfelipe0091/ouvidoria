import Link from 'next/link'

import { Card, LinkButton } from '@/components/ui'
import { getChannel } from '@/lib/channel'

export default async function ChannelHome(props: PageProps<'/[slug]'>) {
  const { slug } = await props.params
  const channel = await getChannel(slug)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ouvidoria | {channel.company.name}
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          {channel.branding.intro_text ??
            'Este é um espaço seguro para registrar sua manifestação. Reclamações, denúncias, sugestões, elogios, solicitações e dúvidas são recebidas e tratadas com sigilo.'}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">Registrar manifestação</h2>
          <p className="flex-1 text-xs leading-relaxed text-muted">
            Conte o que aconteceu. Ao final você recebe um protocolo e um código
            para acompanhar o andamento.
          </p>
          <LinkButton href={`/${slug}/registrar`}>Registrar</LinkButton>
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">Consultar manifestação</h2>
          <p className="flex-1 text-xs leading-relaxed text-muted">
            Já registrou? Informe o protocolo e o código de acompanhamento para
            ver o andamento e conversar com a ouvidoria.
          </p>
          <LinkButton href={`/${slug}/consultar`} variant="secondary">
            Consultar
          </LinkButton>
        </Card>
      </div>

      {channel.options.allow_anonymous ? (
        <p className="text-xs leading-relaxed text-muted">
          Você pode registrar <strong className="font-medium text-foreground">de forma anônima</strong>.
          Nesse caso nenhum dado pessoal é solicitado ou armazenado — o
          acompanhamento é feito apenas pelo protocolo e pelo código.
        </p>
      ) : null}

      <p className="text-xs text-muted">
        É da equipe da ouvidoria?{' '}
        <Link href="/entrar" className="underline underline-offset-4">
          Acessar o painel
        </Link>
      </p>
    </main>
  )
}

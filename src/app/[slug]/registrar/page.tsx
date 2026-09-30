import Link from 'next/link'

import { Icon } from '@/components/landing/icons'
import { getChannel } from '@/lib/channel'
import { RegistrationForm } from './form'

export default async function RegisterPage(props: PageProps<'/[slug]/registrar'>) {
  const { slug } = await props.params
  const channel = await getChannel(slug)

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:py-10">
      <Link href={`/${slug}`} className="flex w-fit items-center gap-1.5 text-xs text-muted hover:text-foreground">
        <Icon name="arrow-left" size={14} /> Início do canal
      </Link>
      <header className="flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name="message-square-text" size={22} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Registrar manifestação</h1>
          <p className="mt-0.5 text-sm text-muted">Ouvidoria {channel.company.name} · leva poucos minutos</p>
        </div>
      </header>
      <RegistrationForm channel={channel} />
    </main>
  )
}

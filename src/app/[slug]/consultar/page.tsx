import Link from 'next/link'

import { Icon } from '@/components/landing/icons'
import { getChannel } from '@/lib/channel'
import { TrackClient } from './client'

export default async function TrackPage(props: PageProps<'/[slug]/consultar'>) {
  const { slug } = await props.params
  const channel = await getChannel(slug)

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:py-10">
      <Link href={`/${slug}`} className="flex w-fit items-center gap-1.5 text-xs text-muted hover:text-foreground">
        <Icon name="arrow-left" size={14} /> Início do canal
      </Link>
      <header className="flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name="search" size={22} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Consultar manifestação</h1>
          <p className="mt-0.5 text-sm text-muted">Ouvidoria {channel.company.name}</p>
        </div>
      </header>
      <TrackClient slug={slug} />
      <p className="flex gap-2 rounded-xl bg-surface-muted px-4 py-3 text-xs leading-relaxed text-muted">
        <Icon name="lock-keyhole" size={14} className="mt-0.5 shrink-0" />
        O protocolo e o código aparecem ao final do registro. Por segurança, o código não pode ser
        recuperado: sem ele, ninguém — nem a própria ouvidoria — consegue abrir a sua manifestação por aqui.
      </p>
    </main>
  )
}

import Link from 'next/link'

import { BRAND } from '@/lib/brand'
import { getChannel } from '@/lib/channel'

export async function generateMetadata(props: LayoutProps<'/[slug]'>) {
  const { slug } = await props.params
  const channel = await getChannel(slug)
  return {
    title: `Ouvidoria | ${channel.company.name}`,
    description: `Canal de ouvidoria de ${channel.company.name}.`,
  }
}

export default async function ChannelLayout(props: LayoutProps<'/[slug]'>) {
  const { slug } = await props.params
  const channel = await getChannel(slug)

  return (
    /* As cores da empresa entram como variáveis CSS locais, sobrescrevendo os
       tokens do tema apenas dentro do canal. O painel interno segue neutro. */
    <div
      className="flex min-h-full flex-1 flex-col"
      style={
        {
          '--accent': channel.branding.primary_color,
          '--accent-soft': `color-mix(in srgb, ${channel.branding.primary_color} 12%, transparent)`,
        } as React.CSSProperties
      }
    >
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-4">
          {channel.company.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element -- logo vem de
               URL arbitrária do cliente; otimizar exigiria allowlist de domínio */
            <img
              src={channel.company.logo_url}
              alt=""
              className="size-8 rounded object-contain"
            />
          ) : null}
          <Link href={`/${slug}`} className="text-sm font-semibold">
            Ouvidoria
            <span className="text-muted"> | {channel.company.name}</span>
          </Link>
        </div>
      </header>

      <div className="flex-1">{props.children}</div>

      <footer className="border-t border-border px-6 py-5">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{channel.company.name}</span>
          <div className="flex items-center gap-4">
            {channel.branding.privacy_policy_text ? (
              <Link href={`/${slug}/privacidade`} className="underline underline-offset-4">
                Política de privacidade
              </Link>
            ) : null}
            <Link href="/" className="hover:text-foreground">
              Canal operado por {BRAND.name}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

import Link from 'next/link'

import { Logo } from '@/components/marketing'
import { BRAND } from '@/lib/brand'
import { getChannel } from '@/lib/channel'

/*
 * Renderizado a cada visita, de propósito: o canal precisa sair do ar na hora
 * em que a empresa é suspensa e refletir na hora a marca e as categorias. Com
 * `revalidate` por tempo, o prefetch das páginas do canal travava no Next 16
 * (o mesmo problema visto na landing). O custo ficou em uma consulta só por
 * visita — `getChannel` é deduplicado entre metadados, layout e página.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata(props: LayoutProps<'/[slug]'>) {
  const { slug } = await props.params
  const channel = await getChannel(slug)
  const title = `Ouvidoria | ${channel.company.name}`
  const description = `Canal oficial de ouvidoria de ${channel.company.name}: registre reclamações, denúncias, sugestões e elogios com sigilo e acompanhe pelo protocolo.`
  return { title, description, openGraph: { title, description } }
}

/** Iniciais para quando a empresa não tem logo: "Indústria Modelo" → "IM". */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || name.slice(0, 1).toUpperCase()
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
          '--accent-hover': `color-mix(in srgb, ${channel.branding.primary_color} 85%, black)`,
          '--accent-soft': `color-mix(in srgb, ${channel.branding.primary_color} 10%, transparent)`,
        } as React.CSSProperties
      }
    >
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link href={`/${slug}`} className="flex min-w-0 items-center gap-3">
            {channel.company.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element -- logo vem de
                 URL arbitrária do cliente; otimizar exigiria allowlist de domínio */
              <img
                src={channel.company.logo_url}
                alt=""
                className="size-10 shrink-0 rounded-lg bg-surface object-contain"
              />
            ) : (
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground"
              >
                {initials(channel.company.name)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{channel.company.name}</span>
              <span className="block text-xs text-muted">Canal de ouvidoria</span>
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-1 text-sm" aria-label="Canal">
            <Link
              href={`/${slug}/consultar`}
              className="hidden rounded-md px-3 py-2 text-muted transition-colors hover:text-foreground sm:block"
            >
              Consultar
            </Link>
            <Link
              href={`/${slug}/registrar`}
              className="rounded-md bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent-hover sm:text-sm"
            >
              Registrar
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-1">{props.children}</div>

      <footer className="border-t border-border bg-surface px-5 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium text-foreground">{channel.company.name}</span>
            {channel.branding.privacy_policy_text ? (
              <Link href={`/${slug}/privacidade`} className="underline underline-offset-4 hover:text-foreground">
                Política de privacidade
              </Link>
            ) : null}
            <Link href="/entrar" className="hover:text-foreground">
              Acesso da equipe
            </Link>
          </div>
          <Link href="/" className="flex items-center gap-2 hover:text-foreground">
            <span>Canal operado por</span>
            <Logo className="size-4!" />
            <span className="font-medium">{BRAND.name}</span>
          </Link>
        </div>
      </footer>
    </div>
  )
}

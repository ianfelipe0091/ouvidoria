import Image from 'next/image'
import Link from 'next/link'

import logo from '@/../public/landing/logo.png'

/*
 * Cabeçalho e rodapé do site público, divididos entre a landing e as páginas
 * institucionais (Fale conosco). Precisam ficar dentro de um <main className="lp">,
 * que é onde vivem as cores da landing.
 */

/**
 * `home`: a landing aponta as âncoras para a própria página (#top, #planos);
 * as demais páginas apontam para a landing (/, /#planos).
 */
export function SiteHeader({ home = false }: { home?: boolean }) {
  const link = 'hidden px-3 py-2 text-muted-foreground transition-colors hover:text-foreground sm:block'
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
        <Brand href={home ? '#top' : '/'} />
        <nav className="flex items-center gap-3 text-sm" aria-label="Navegação principal">
          <a href={home ? '#planos' : '/#planos'} className={link}>
            Planos
          </a>
          <Link href="/contato" className={link}>
            Fale conosco
          </Link>
          <Link href="/entrar" className={link}>
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
  )
}

export function SiteFooter({ home = false }: { home?: boolean }) {
  return (
    <footer className="border-t border-border py-7">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 px-5 text-xs text-muted-foreground sm:flex-row sm:items-center lg:px-8">
        <Brand href={home ? '#top' : '/'} />
        <p>
          {'É cliente e procura o canal de uma empresa? O endereço tem o formato '}
          <code className="text-foreground">/empresa</code>.
        </p>
        <Link href="/contato" className="font-medium text-foreground hover:text-primary">
          Fale conosco
        </Link>
      </div>
    </footer>
  )
}

function Brand({ href }: { href: string }) {
  return (
    <a href={href} className="flex items-center" aria-label="Nossa Ouvidoria, início">
      <Image src={logo} alt="Nossa Ouvidoria" priority unoptimized className="h-9 w-auto" />
    </a>
  )
}

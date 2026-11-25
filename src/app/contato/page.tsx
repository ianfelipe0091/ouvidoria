import type { Metadata } from 'next'
import Link from 'next/link'

import { Icon } from '@/components/landing/icons'
import { SiteFooter, SiteHeader } from '@/components/landing/site-chrome'
import { BRAND, contactWhatsappUrl, salesWhatsappLabel } from '@/lib/brand'
import { ContactForm } from './form'

export const metadata: Metadata = {
  title: `Fale conosco — ${BRAND.name}`,
  description:
    'Fale com a equipe da Nossa Ouvidoria: tire dúvidas sobre planos, peça uma demonstração ' +
    'ou converse pelo WhatsApp.',
}

/*
 * "Fale conosco" do site. Fica em /contato, que já é um apelido reservado —
 * nenhuma empresa pode ter esse endereço de canal.
 */
export default function ContatoPage() {
  const whatsappUrl = contactWhatsappUrl()
  const whatsappLabel = salesWhatsappLabel()

  return (
    <main id="top" className="lp min-h-screen overflow-hidden bg-background text-foreground">
      <SiteHeader />

      <section className="border-b border-border bg-hero">
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 lg:px-8 lg:pb-16 lg:pt-20">
          <span className="inline-flex rounded-full border border-primary/15 bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
            Fale conosco
          </span>
          <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-[1.1] sm:text-5xl">
            Vamos conversar sobre a ouvidoria da sua empresa
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Dúvidas sobre planos, uma demonstração para a sua diretoria ou um projeto para uma rede
            de franquias: mande sua mensagem ou chame direto no WhatsApp.
          </p>
        </div>
      </section>

      <section className="py-14 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 lg:grid-cols-[1.6fr_1fr] lg:px-8">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold">Envie uma mensagem</h2>
            <p className="mt-2 mb-6 text-sm text-muted-foreground">
              Respondemos em horário comercial, normalmente no mesmo dia.
            </p>
            <ContactForm whatsappUrl={whatsappUrl} />
          </div>

          <aside className="flex flex-col gap-6">
            {whatsappUrl ? (
              <div className="rounded-xl bg-foreground p-6 text-background sm:p-8">
                <span className="grid size-12 place-items-center rounded-full bg-success text-white">
                  <Icon name="message-circle" size={22} />
                </span>
                <h2 className="mt-5 text-xl font-bold">Prefere o WhatsApp?</h2>
                <p className="mt-2 text-sm leading-6 text-background/70">
                  Fale direto com a nossa equipe comercial.
                </p>
                {whatsappLabel ? (
                  <p className="mt-4 text-2xl font-bold tracking-tight">{whatsappLabel}</p>
                ) : null}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-success px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                >
                  Chamar no WhatsApp <Icon name="arrow-right" size={16} />
                </a>
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-hero p-6 sm:p-8">
              <h2 className="text-lg font-bold">Quer ver funcionando agora?</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Crie a conta da sua empresa e teste a plataforma completa, sem cartão de crédito.
              </p>
              <Link
                href="/criar-conta"
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
              >
                Criar conta grátis <Icon name="arrow-right" size={16} />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}

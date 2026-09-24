'use client'

import { useEffect, useState } from 'react'
import Image, { type StaticImageData } from 'next/image'

import { Icon } from './icons'

export type Audience = { title: string; text: string; img: StaticImageData }

/** Cartões por vista em cada faixa de largura — os mesmos cortes do sm/lg do Tailwind. */
const perViewFor = (width: number) => (width >= 1024 ? 3 : width >= 640 ? 2 : 1)

/**
 * "Uma Ouvidoria que cresce com você" — carrossel dos públicos-alvo.
 *
 * A largura de cada cartão vem do CSS (w-full / sm:w-1/2 / lg:w-1/3), e não do
 * JavaScript: assim a primeira pintura, antes da hidratação, já sai certa no
 * celular. O estado só guarda quantos cabem por vista para calcular o passo,
 * as setas e os pontos.
 */
export function Growth({ audiences }: { audiences: Audience[] }) {
  const [index, setIndex] = useState(0)
  const [perView, setPerView] = useState(3)

  useEffect(() => {
    const update = () => setPerView(perViewFor(window.innerWidth))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const last = Math.max(0, audiences.length - perView)
  const current = Math.min(index, last)
  const offset = (current / perView) * 100
  const step = (delta: number) => setIndex((i) => Math.max(0, Math.min(last, i + delta)))

  return (
    <section className="bg-background py-20">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase text-primary">Cresce com você</span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Uma Ouvidoria que cresce com você</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            Da empresa com uma unidade à operação com mais de 1.000 pontos de atendimento. Nossa
            plataforma acompanha sua estrutura, centraliza a escuta e transforma manifestações em
            informação para a gestão.
          </p>
        </div>

        <div className="relative mt-12">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${offset}%)` }}
            >
              {audiences.map((a) => (
                <div key={a.title} className="w-full shrink-0 px-3 sm:w-1/2 lg:w-1/3">
                  <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md shadow-black/5 transition-shadow hover:shadow-lg hover:shadow-black/10">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={a.img}
                        alt={a.title}
                        unoptimized
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="text-lg font-bold text-foreground">{a.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{a.text}</p>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>

          {current > 0 ? (
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Anterior"
              className="absolute -left-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background shadow-md transition-colors hover:bg-secondary lg:-left-5"
            >
              <Icon name="chevron-left" size={18} />
            </button>
          ) : null}
          {current < last ? (
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Próximo"
              className="absolute -right-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background shadow-md transition-colors hover:bg-secondary lg:-right-5"
            >
              <Icon name="chevron-right" size={18} />
            </button>
          ) : null}
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: last + 1 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ir para o grupo ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === current ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-muted-foreground/40'}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

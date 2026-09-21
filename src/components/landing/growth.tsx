'use client'

import { useState } from 'react'
import Image, { type StaticImageData } from 'next/image'

export type Audience = { title: string; desc: string; img: StaticImageData }

/**
 * "Uma Ouvidoria que cresce com você" — carrossel com os públicos-alvo.
 * Mostra três cartões por vez; a seta avança um cartão e os pontos indicam
 * a posição. Réplica do design de referência.
 */
export function Growth({ audiences }: { audiences: Audience[] }) {
  const perView = 3
  const maxIndex = Math.max(0, audiences.length - perView)
  const [index, setIndex] = useState(0)

  const go = (i: number) => setIndex(Math.min(maxIndex, Math.max(0, i)))

  return (
    <section className="bg-[var(--lp-bg)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--lp-primary)]">
          CRESCE COM VOCÊ
        </p>
        <h2 className="mt-3 max-w-2xl text-2xl font-extrabold tracking-tight md:text-4xl">
          Uma Ouvidoria que cresce com você
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--lp-muted)] md:text-base">
          Da empresa com uma unidade à operação com mais de 1.000 pontos de atendimento.
          Nossa plataforma acompanha sua estrutura, centraliza a escuta e transforma
          manifestações em informação para a gestão.
        </p>

        <div className="relative mt-10">
          <div className="overflow-hidden">
            <div
              className="flex gap-6 transition-transform duration-500 ease-out"
              style={{ transform: `translateX(calc(-${index} * (100% + 1.5rem) / ${perView}))` }}
            >
              {audiences.map((a) => (
                <article
                  key={a.title}
                  className="flex w-[calc((100%-3rem)/3)] shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--lp-border)] bg-white"
                >
                  <Image
                    src={a.img}
                    alt=""
                    sizes="(min-width: 768px) 33vw, 100vw"
                    placeholder="blur"
                    className="h-44 w-full object-cover"
                  />
                  <div className="flex flex-col gap-2 p-6">
                    <h3 className="text-base font-bold">{a.title}</h3>
                    <p className="text-sm leading-relaxed text-[var(--lp-muted)]">{a.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index >= maxIndex}
            aria-label="Próximo"
            className="absolute -right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-[var(--lp-border)] bg-white text-[var(--lp-fg)] shadow-md transition hover:bg-[var(--lp-soft)] disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Ir para o grupo ${i + 1}`}
              className={[
                'h-2 rounded-full transition-all',
                i === index ? 'w-6 bg-[var(--lp-primary)]' : 'w-2 bg-[var(--lp-border)]',
              ].join(' ')}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

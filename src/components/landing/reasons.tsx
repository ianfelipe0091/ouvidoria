'use client'

import { useState } from 'react'
import Image, { type StaticImageData } from 'next/image'

export type Reason = {
  label: string; head: string; desc: string; short: string; img: StaticImageData
}

/**
 * "Porque ter uma plataforma de Ouvidoria" — seção escura com stepper 01–07.
 * Clicar num número troca o cartão e a imagem. Réplica do design de referência.
 */
export function Reasons({ reasons }: { reasons: Reason[] }) {
  const [active, setActive] = useState(0)
  const r = reasons[active]

  return (
    <section className="bg-[var(--lp-dark)] text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <h2 className="max-w-xl text-2xl font-extrabold tracking-tight md:text-4xl">
          Porque ter uma plataforma de{' '}
          <span className="text-[var(--lp-primary)]">Ouvidoria</span>
        </h2>

        {/* Stepper */}
        <div className="mt-10 overflow-x-auto">
          <div className="flex min-w-[720px] items-start gap-0">
            {reasons.map((item, i) => {
              const on = i === active
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActive(i)}
                  className="group flex flex-1 flex-col items-start gap-3 text-left"
                >
                  <span className="flex w-full items-center">
                    <span
                      className={[
                        'grid size-9 shrink-0 place-items-center rounded-md text-sm font-bold transition',
                        on ? 'bg-[var(--lp-primary)] text-white' : 'bg-white/10 text-white/60',
                      ].join(' ')}
                    >
                      {item.label}
                    </span>
                    {i < reasons.length - 1 ? (
                      <span className="h-px flex-1 bg-white/15" />
                    ) : null}
                  </span>
                  <span
                    className={[
                      'pr-4 text-xs leading-snug transition',
                      on ? 'font-semibold text-white' : 'text-white/45',
                    ].join(' ')}
                  >
                    {item.short}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Conteúdo do passo selecionado */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <span className="text-sm font-semibold text-[var(--lp-primary)]">
              {r.label} / 07
            </span>
            <h3 className="mt-3 text-xl font-bold md:text-2xl">{r.head}</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{r.desc}</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl">
            <Image
              src={r.img}
              alt=""
              sizes="(min-width: 1024px) 50vw, 100vw"
              placeholder="blur"
              className="h-full max-h-[340px] w-full object-cover"
            />
            <span className="absolute right-5 bottom-3 text-6xl font-extrabold text-white/85 drop-shadow">
              {r.label}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import Image, { type StaticImageData } from 'next/image'

import { Icon, type IconName } from './icons'

export type Reason = { title: string; text: string; icon: IconName; img: StaticImageData }

const pad = (n: number) => String(n + 1).padStart(2, '0')

/**
 * "Porque ter uma plataforma de Ouvidoria" — stepper 01–07.
 *
 * Avança sozinho a cada 4s, mas só enquanto a seção está na tela: fora dela o
 * intervalo para, para não trocar o conteúdo de quem ainda não chegou ali.
 */
export function Reasons({ reasons }: { reasons: Reason[] }) {
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false), {
      threshold: 0.3,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => setActive((i) => (i + 1) % reasons.length), 4000)
    return () => clearInterval(id)
  }, [visible, reasons.length])

  return (
    <section ref={ref} className="bg-foreground py-20 text-background">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <h2 className="max-w-2xl text-3xl font-extrabold sm:text-4xl">
          Porque ter uma plataforma de <span className="text-info">Ouvidoria</span>
        </h2>

        <div className="relative mt-10">
          <div className="absolute left-0 right-0 top-5 hidden h-px bg-background/15 lg:block" />
          <div className="relative flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-7 lg:overflow-visible">
            {reasons.map((reason, i) => {
              const on = i === active
              return (
                <button
                  key={reason.title}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-pressed={on}
                  className="group flex min-w-[150px] flex-col items-center gap-2 lg:min-w-0"
                >
                  <span
                    className={`relative z-10 grid size-10 place-items-center rounded-lg text-sm font-bold transition-all duration-300 ${on ? 'scale-[1.3] bg-info text-info-foreground' : 'bg-foreground text-background/60 ring-1 ring-inset ring-background/20 group-hover:text-background'}`}
                  >
                    {pad(i)}
                  </span>
                  <span
                    className={`text-center text-[11px] font-semibold leading-tight transition-colors ${on ? 'text-background' : 'text-background/50'}`}
                  >
                    {reason.title}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-8">
          {reasons.map((reason, i) => (
            <div key={reason.title} className={i === active ? 'grid gap-4 lg:grid-cols-2' : 'hidden'}>
              <div className="min-h-[400px] rounded-2xl border border-background/10 bg-background/5 p-8">
                <span className="text-sm font-bold text-info">{pad(i)} / 07</span>
                <h3 className="mt-3 text-2xl font-extrabold">{reason.title}</h3>
                <p className="mt-4 leading-7 text-background/70">{reason.text}</p>
              </div>
              <div className="relative grid min-h-[400px] place-items-center overflow-hidden rounded-2xl border border-info/20 bg-info/10 p-8">
                <Image
                  src={reason.img}
                  alt=""
                  unoptimized
                  className="absolute inset-0 size-full object-cover opacity-60"
                />
                <Icon name={reason.icon} size={88} className="relative z-10 text-info/70 drop-shadow-lg" />
                <span className="absolute bottom-4 right-6 z-10 text-5xl font-extrabold text-info/50 drop-shadow">
                  {pad(i)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

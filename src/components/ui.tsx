/**
 * Primitivos de interface.
 *
 * São Server Components por padrão: nenhum deles guarda estado. O que precisa
 * de interatividade recebe "use client" no próprio arquivo que o usa.
 */
import { cloneElement, isValidElement, useId } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

type Tone = 'neutral' | 'info' | 'warn' | 'ok' | 'danger' | 'accent'

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-muted',
  info: 'bg-info-soft text-info',
  warn: 'bg-warn-soft text-warn',
  ok: 'bg-ok-soft text-ok',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent-soft text-accent',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Selo com bolinha — para situações que o olho precisa varrer numa tabela. */
export function StatusDot({ tone = 'neutral' }: { tone?: Tone }) {
  const color: Record<Tone, string> = {
    neutral: 'bg-muted',
    info: 'bg-info',
    warn: 'bg-warn',
    ok: 'bg-ok',
    danger: 'bg-danger',
    accent: 'bg-accent',
  }
  return <span aria-hidden className={cn('size-1.5 rounded-full', color[tone])} />
}

export function Card({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-2xl border border-border bg-surface', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, description, action }: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

const BUTTON_VARIANT = {
  // Escurecer o azul no hover (em vez de baixar a opacidade) mantém o botão
  // sólido sobre qualquer fundo — é o comportamento do botão da landing.
  primary: 'bg-accent text-accent-foreground hover:bg-accent-hover',
  secondary: 'border border-border bg-surface hover:bg-surface-muted',
  ghost: 'hover:bg-surface-muted',
  danger: 'border border-border bg-surface text-danger hover:bg-danger-soft',
} as const

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ComponentProps<'button'> & {
  variant?: keyof typeof BUTTON_VARIANT
  size?: 'sm' | 'md'
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        BUTTON_VARIANT[variant],
        className,
      )}
      {...rest}
    />
  )
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ComponentProps<'a'> & {
  variant?: keyof typeof BUTTON_VARIANT
  size?: 'sm' | 'md'
}) {
  return (
    <a
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        BUTTON_VARIANT[variant],
        className,
      )}
      {...rest}
    />
  )
}

/* Controles ocupam a largura toda por padrão, que é o caso dentro de <Field>.
   Onde o controle deve caber no conteúdo (barras de filtro, seletores inline),
   passe `w-auto!` — no Tailwind v4 o `!` vai no fim e vence o w-full daqui. */
const CONTROL =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm ' +
  'placeholder:text-muted disabled:opacity-60'

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, className)} {...rest} />
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'min-h-28 resize-y', className)} {...rest} />
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select className={cn(CONTROL, 'appearance-none pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

/**
 * Rótulo, controle e dica.
 *
 * A dica fica FORA do <label>, ligada por aria-describedby. Dentro do label ela
 * entraria no nome acessível do campo — um leitor de tela anunciaria
 * "Nome fantasia, se vazio usamos a razão social" como se fosse o nome do
 * campo, e dois campos com dicas parecidas viram indistinguíveis.
 */
export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string
  hint?: ReactNode
  required?: boolean
  children: ReactNode
  className?: string
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined

  // O controle recebe id e aria-describedby sem que cada chamada precise
  // repetir isso. Filho que não seja elemento único fica sem a ligação, mas
  // ainda assim dentro do label.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? id,
        'aria-describedby':
          (children.props as { 'aria-describedby'?: string })['aria-describedby'] ?? hintId,
      })
    : children

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* O asterisco fica FORA do <label>, e não apenas com aria-hidden: assim
          nem o nome acessível nem o texto do rótulo o incluem. Quem comunica a
          obrigatoriedade é o atributo `required` do controle; o asterisco é a
          convenção visual para quem enxerga. */}
      <div className="flex items-center gap-0.5">
        <label htmlFor={id} className="text-xs font-medium">
          {label}
        </label>
        {required ? <span aria-hidden className="text-xs text-danger">*</span> : null}
      </div>
      {control}
      {hint ? (
        <span id={hintId} className="text-xs text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

export function EmptyState({ title, description, action }: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/** Mensagem de erro de uma Server Action. Vazio não ocupa espaço. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
      {message}
    </p>
  )
}

export function PageHeader({ title, description, action }: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  )
}

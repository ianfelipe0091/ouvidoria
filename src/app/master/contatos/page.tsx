import Link from 'next/link'

import { Badge, Button, Card, EmptyState, PageHeader, cn } from '@/components/ui'
import { requirePlatformAdmin } from '@/lib/auth'
import { setContactStatus } from '../actions'
import { fetchAll, whatsappLink } from '../data'

const STATUS = {
  nova: { label: 'Nova', tone: 'accent' },
  respondida: { label: 'Respondida', tone: 'ok' },
  arquivada: { label: 'Arquivada', tone: 'neutral' },
} as const

type Status = keyof typeof STATUS

const when = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

/** Mensagens do formulário "Fale conosco" do site. */
export default async function MasterContactsPage(props: PageProps<'/master/contatos'>) {
  const params = await props.searchParams
  const archived = params.ver === 'arquivadas'
  const { supabase } = await requirePlatformAdmin()

  const messages = await fetchAll((from, to) => {
    const q = supabase
      .from('contact_messages')
      .select('id, name, email, phone, company, message, status, created_at, handled_at')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
    return archived ? q.eq('status', 'arquivada') : q.neq('status', 'arquivada')
  })

  const unread = messages.filter((m) => m.status === 'nova').length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Fale conosco"
        description={
          archived
            ? 'Mensagens arquivadas.'
            : unread
              ? `${unread} ${unread === 1 ? 'mensagem nova' : 'mensagens novas'} esperando resposta.`
              : 'Mensagens enviadas pela página de contato do site.'
        }
        action={
          <div className="flex gap-1 rounded-lg bg-surface-muted p-1 text-xs">
            <Link
              href="/master/contatos"
              className={cn('rounded-md px-3 py-1.5', !archived ? 'bg-surface font-medium shadow-sm' : 'text-muted')}
            >
              Caixa de entrada
            </Link>
            <Link
              href="/master/contatos?ver=arquivadas"
              className={cn('rounded-md px-3 py-1.5', archived ? 'bg-surface font-medium shadow-sm' : 'text-muted')}
            >
              Arquivadas
            </Link>
          </div>
        }
      />

      {!messages.length ? (
        <Card>
          <EmptyState
            title={archived ? 'Nenhuma mensagem arquivada' : 'Nenhuma mensagem por enquanto'}
            description={
              archived ? undefined : 'Quando alguém escrever pela página /contato do site, a mensagem aparece aqui.'
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((m) => {
            const status = (m.status in STATUS ? m.status : 'nova') as Status
            const wa = whatsappLink(m.phone)
            return (
              <li key={m.id}>
                <Card className={cn(status === 'nova' && 'border-accent/40')}>
                  <div className="flex flex-col gap-3 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          {m.name}
                          {m.company ? <span className="font-normal text-muted">· {m.company}</span> : null}
                          <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
                        </p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                          <a href={`mailto:${m.email}`} className="hover:text-foreground hover:underline">
                            {m.email}
                          </a>
                          {m.phone ? (
                            wa ? (
                              <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
                                {m.phone} (WhatsApp)
                              </a>
                            ) : (
                              <span>{m.phone}</span>
                            )
                          ) : null}
                        </p>
                      </div>
                      <p className="text-xs text-muted">{when(m.created_at)}</p>
                    </div>

                    <p className="text-sm leading-6 whitespace-pre-wrap break-words">{m.message}</p>

                    <div className="flex flex-wrap gap-2">
                      {status !== 'respondida' ? (
                        <form action={setContactStatus.bind(null, m.id, 'respondida')}>
                          <Button size="sm" variant="secondary" type="submit">Marcar como respondida</Button>
                        </form>
                      ) : null}
                      {status !== 'nova' ? (
                        <form action={setContactStatus.bind(null, m.id, 'nova')}>
                          <Button size="sm" variant="ghost" type="submit">Voltar para nova</Button>
                        </form>
                      ) : null}
                      {status !== 'arquivada' ? (
                        <form action={setContactStatus.bind(null, m.id, 'arquivada')}>
                          <Button size="sm" variant="ghost" type="submit">Arquivar</Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

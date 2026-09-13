import { checkSupabaseConnection } from '@/lib/supabase/health'

// O status reflete uma checagem de rede feita agora, não no build.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const health = await checkSupabaseConnection()

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ouvidoria</h1>
        <p className="text-sm opacity-70">
          Projeto Next.js conectado ao Supabase. Esta página confirma a conexão.
        </p>
      </header>

      <section
        className={`rounded-lg border p-5 ${
          health.ok
            ? 'border-emerald-600/30 bg-emerald-500/5'
            : 'border-red-600/30 bg-red-500/5'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`size-2.5 rounded-full ${health.ok ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
          <h2 className="font-medium">
            {health.ok ? 'Conectado ao Supabase' : 'Falha ao conectar ao Supabase'}
          </h2>
        </div>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="opacity-60">Projeto</dt>
          <dd className="truncate font-mono text-xs">{health.url ?? '—'}</dd>

          <dt className="opacity-60">Latência</dt>
          <dd className="font-mono text-xs">
            {health.latencyMs === null ? '—' : `${health.latencyMs} ms`}
          </dd>

          <dt className="opacity-60">Sessão</dt>
          <dd className="text-xs">
            {health.authenticated ? 'usuário autenticado' : 'nenhum usuário autenticado'}
          </dd>

          {health.error ? (
            <>
              <dt className="opacity-60">Erro</dt>
              <dd className="font-mono text-xs break-words">{health.error}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <p className="text-sm opacity-70">
        A mesma checagem em JSON está em{' '}
        <a className="underline underline-offset-4" href="/api/health">
          /api/health
        </a>
        .
      </p>
    </main>
  )
}

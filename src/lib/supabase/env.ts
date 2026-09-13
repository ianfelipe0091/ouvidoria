/**
 * Leitura centralizada e validada das variáveis de ambiente do Supabase.
 *
 * As variáveis são lidas via `process.env.NOME_LITERAL` (e não por indexação
 * dinâmica) porque o Next.js substitui as referências `NEXT_PUBLIC_*` em tempo
 * de build — uma leitura dinâmica não seria substituída e chegaria `undefined`
 * no bundle do browser.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}. ` +
        'Copie o arquivo .env.example para .env.local e preencha os valores do projeto Supabase.',
    )
  }
  return value
}

/** URL da API do projeto Supabase. Exposta ao browser. */
export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
}

/**
 * Chave publicável (publishable). Pode ser exposta ao browser: o acesso aos
 * dados é controlado pelas políticas de RLS do banco, não por esta chave.
 */
export function supabasePublishableKey(): string {
  return required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
}

/**
 * Chave secreta (service role). Ignora completamente as políticas de RLS,
 * portanto NUNCA deve ser importada em Client Components nem exposta ao browser.
 * Use somente em Route Handlers, Server Actions ou scripts de servidor.
 */
export function supabaseSecretKey(): string {
  if (typeof window !== 'undefined') {
    throw new Error('SUPABASE_SECRET_KEY não pode ser lida no browser.')
  }
  return required('SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY)
}

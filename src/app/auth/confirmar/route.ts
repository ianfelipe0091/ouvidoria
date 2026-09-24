import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

/**
 * Confirma um link enviado por e-mail (hoje: recuperação de senha) e abre a
 * sessão, gravando os cookies. Depois segue para a tela indicada em `next`.
 *
 * Aceita as duas formas de link:
 * - `code`: o template PADRÃO do Supabase (ConfirmationURL) passa por aqui após
 *   validar o token; trocamos o code pela sessão. É o caminho em uso hoje.
 * - `token_hash`: usado por um template próprio (ver supabase/auth-templates),
 *   que funciona também quando o e-mail é aberto em outro aparelho. Fica pronto
 *   para quando houver SMTP próprio e o template personalizado.
 *
 * Sem parâmetro válido, volta para /esqueci-senha pedindo um link novo.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = url.searchParams.get('next') ?? '/redefinir-senha'

  // Só caminhos internos: um `next` externo viraria redirect aberto.
  const dest = next.startsWith('/') && !next.startsWith('//') ? next : '/redefinir-senha'

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(dest, url.origin))
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(dest, url.origin))
  }

  return NextResponse.redirect(new URL('/esqueci-senha?erro=link', url.origin))
}

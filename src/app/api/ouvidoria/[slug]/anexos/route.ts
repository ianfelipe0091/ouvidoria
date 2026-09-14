import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { BUCKET, storagePath, validateUpload } from '@/lib/attachments'

export const dynamic = 'force-dynamic'

/**
 * Recebe anexos do canal público.
 *
 * O manifestante não tem acesso ao Storage. Esta rota confere o par
 * protocolo + código chamando a mesma função que a tela de consulta usa — e só
 * depois disso grava, com a chave secreta. Sem essa checagem, qualquer um que
 * adivinhasse um protocolo poderia anexar arquivos à manifestação alheia.
 */
export async function POST(request: Request, context: RouteContext<'/api/ouvidoria/[slug]/anexos'>) {
  const { slug } = await context.params
  const form = await request.formData()

  const protocol = String(form.get('protocol') ?? '')
  const trackingCode = String(form.get('tracking_code') ?? '')
  const files = form.getAll('files').filter((f): f is File => f instanceof File)

  if (!protocol || !trackingCode) {
    return NextResponse.json({ error: 'Protocolo e código são obrigatórios.' }, { status: 400 })
  }
  if (!files.length) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
  }

  // Prova de posse do código. Falha aqui não distingue protocolo inexistente
  // de código errado — a função do banco devolve o mesmo erro nos dois casos.
  const anon = await createClient()
  const { error: accessError } = await anon.rpc('track_manifestacao', {
    p_company_slug: slug,
    p_protocol: protocol,
    p_tracking_code: trackingCode,
  })
  if (accessError) {
    return NextResponse.json({ error: 'Protocolo ou código inválido.' }, { status: 403 })
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'Envio de anexos indisponível: SUPABASE_SECRET_KEY não configurada.' },
      { status: 503 },
    )
  }

  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (!company) return NextResponse.json({ error: 'Canal não encontrado.' }, { status: 404 })

  const { data: settings } = await admin
    .from('company_settings')
    .select('allow_attachments, max_attachment_mb')
    .eq('company_id', company.id)
    .maybeSingle()

  if (!settings?.allow_attachments) {
    return NextResponse.json({ error: 'Esta ouvidoria não aceita anexos.' }, { status: 403 })
  }

  const { data: occurrence } = await admin
    .from('occurrences')
    .select('id')
    .eq('company_id', company.id)
    .eq('protocol', protocol.trim().toUpperCase())
    .maybeSingle()
  if (!occurrence) return NextResponse.json({ error: 'Manifestação não encontrada.' }, { status: 404 })

  const maxMb = settings.max_attachment_mb ?? 10
  const saved: string[] = []

  for (const file of files) {
    const check = validateUpload(file, maxMb)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

    const path = storagePath(company.id, occurrence.id, file.name)
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { error: rowError } = await admin.from('attachments').insert({
      company_id: company.id,
      occurrence_id: occurrence.id,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by_reporter: true,
    })

    if (rowError) {
      // Sem a linha, o arquivo ficaria órfão no bucket, invisível e sem dono.
      await admin.storage.from(BUCKET).remove([path])
      return NextResponse.json({ error: rowError.message }, { status: 500 })
    }

    saved.push(file.name)
  }

  await admin.from('occurrence_events').insert({
    company_id: company.id,
    occurrence_id: occurrence.id,
    actor_label: 'manifestante',
    event_type: 'anexo_recebido',
    description: `Manifestante anexou ${saved.length} ${saved.length === 1 ? 'arquivo' : 'arquivos'}.`,
  })

  return NextResponse.json({ ok: true, saved })
}

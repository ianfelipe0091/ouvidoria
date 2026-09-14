import 'server-only'

/** Tipos aceitos, conforme a especificação do canal. */
export const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export const ALLOWED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx'

export const BUCKET = 'anexos'

/**
 * Sanitiza o nome do arquivo enviado.
 *
 * O nome vem do usuário e vira parte do caminho no Storage: sem limpeza, um
 * "../" escaparia da pasta do tenant, e acentos ou espaços quebrariam a URL.
 * O nome original continua guardado na tabela `attachments`, para exibição.
 */
export function safeFileName(name: string) {
  const normalized = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(-80)

  return normalized || 'arquivo'
}

export function storagePath(companyId: string, occurrenceId: string, fileName: string) {
  return `${companyId}/${occurrenceId}/${crypto.randomUUID()}-${safeFileName(fileName)}`
}

export type UploadCheck = { ok: true } | { ok: false; error: string }

export function validateUpload(file: { size: number; type: string }, maxMb: number): UploadCheck {
  if (file.size <= 0) return { ok: false, error: 'Arquivo vazio.' }
  if (file.size > maxMb * 1024 * 1024) {
    return { ok: false, error: `Cada arquivo pode ter no máximo ${maxMb} MB.` }
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: 'Formato não aceito. Envie PDF, imagem, Word ou Excel.' }
  }
  return { ok: true }
}

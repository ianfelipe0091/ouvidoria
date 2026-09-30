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

/**
 * Confere os primeiros bytes do arquivo contra o tipo declarado. O tipo vem do
 * navegador e pode ser forjado: um HTML renomeado para .pdf passaria só pela
 * checagem de MIME.
 */
export async function matchesSignature(file: Blob & { type: string }) {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b)
  switch (file.type) {
    case 'application/pdf':
      return starts(0x25, 0x50, 0x44, 0x46) // %PDF
    case 'image/jpeg':
      return starts(0xff, 0xd8, 0xff)
    case 'image/png':
      return starts(0x89, 0x50, 0x4e, 0x47)
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return starts(0x50, 0x4b, 0x03, 0x04) // zip (docx/xlsx)
    case 'application/msword':
    case 'application/vnd.ms-excel':
      return starts(0xd0, 0xcf, 0x11, 0xe0) // OLE (doc/xls antigos)
    default:
      return false
  }
}

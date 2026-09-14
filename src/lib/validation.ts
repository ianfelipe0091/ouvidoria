/**
 * Validações de entrada compartilhadas entre cliente e servidor.
 *
 * O servidor é quem decide — o cliente só antecipa o erro para não fazer a
 * pessoa esperar uma ida ao servidor por um dígito errado.
 */

/** Mantém apenas os dígitos. */
export const digits = (value: string) => value.replace(/\D/g, '')

/**
 * Valida CNPJ pelos dígitos verificadores.
 *
 * Checar só o tamanho aceitaria "00000000000000" e qualquer sequência de 14
 * dígitos — num cadastro comercial isso vira base suja já no primeiro dia.
 */
export function isValidCnpj(value: string): boolean {
  const cnpj = digits(value)
  if (cnpj.length !== 14) return false
  // Sequências repetidas passam no cálculo, mas não são CNPJs reais.
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  const checkDigit = (length: number) => {
    let sum = 0
    let weight = length - 7
    for (let i = 0; i < length; i++) {
      sum += Number(cnpj[i]) * weight--
      if (weight < 2) weight = 9
    }
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  return checkDigit(12) === Number(cnpj[12]) && checkDigit(13) === Number(cnpj[13])
}

export function isValidCpf(value: string): boolean {
  const cpf = digits(value)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const checkDigit = (length: number) => {
    let sum = 0
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return checkDigit(9) === Number(cpf[9]) && checkDigit(10) === Number(cpf[10])
}

export function formatCnpj(value: string) {
  const d = digits(value).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function formatPhone(value: string) {
  const d = digits(value).slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export type PasswordCheck = { ok: boolean; message?: string }

/**
 * Exigências de senha.
 *
 * Comprimento é o que mais importa; regras de "um símbolo, um número" empurram
 * as pessoas para senhas previsíveis. Mantemos um mínimo de 10 e barramos as
 * mais óbvias.
 */
export function checkPassword(password: string): PasswordCheck {
  if (password.length < 10) {
    return { ok: false, message: 'A senha precisa ter pelo menos 10 caracteres.' }
  }
  const obvious = ['senha', 'password', '123456', 'ouvidoria', 'qwerty', 'admin']
  const lowered = password.toLowerCase()
  if (obvious.some((word) => lowered.includes(word))) {
    return { ok: false, message: 'Escolha uma senha menos previsível.' }
  }
  return { ok: true }
}

import 'server-only'

import { headers } from 'next/headers'

/**
 * Limite de tentativas por IP, em memória, janela deslizante.
 *
 * Protege as portas públicas (login, cadastro, canal de manifestação, consulta,
 * anexos) de robôs que disparam centenas de pedidos seguidos. Cada instância
 * da função guarda o próprio contador, então o limite é por instância: segura
 * o abuso comum (um script martelando), não um ataque distribuído — para isso
 * existe o Firewall da Vercel, configurado no painel dela.
 */

type Bucket = { hits: number[] }
const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

/** IP do visitante como a Vercel informa (o primeiro da cadeia). */
export async function clientIp() {
  const h = await headers()
  return (
    h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'desconhecido'
  )
}

/**
 * true quando ainda cabe mais uma tentativa (e a registra); false quando o
 * limite da janela estourou.
 */
export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  // Faxina ocasional para o mapa não crescer sem fim.
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) if (!b.hits.some((t) => now - t < 3_600_000)) buckets.delete(k)
    lastSweep = now
  }
  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket)
    return false
  }
  bucket.hits.push(now)
  buckets.set(key, bucket)
  return true
}

/** Atalho: limita por IP + nome da ação. */
export async function allowIp(action: string, limit: number, windowMs: number) {
  return allow(`${action}:${await clientIp()}`, limit, windowMs)
}

export const TOO_MANY = 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.'

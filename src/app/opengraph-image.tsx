import { ImageResponse } from 'next/og'

import { OG_SIZE, OgArt, logoDataUrl } from '@/lib/og'

export const alt = 'Nossa Ouvidoria — plataforma de ouvidoria para empresas'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    <OgArt
      logo={await logoDataUrl()}
      kicker="Plataforma de ouvidoria para empresas"
      title="Receba, trate e responda manifestações com prazo e sigilo."
      footer="nossaouvidoria.com.br"
    />,
    size,
  )
}

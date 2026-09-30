import { ImageResponse } from 'next/og'

import { getChannel } from '@/lib/channel'
import { OG_SIZE, OgArt, logoDataUrl } from '@/lib/og'

export const alt = 'Canal de ouvidoria'
export const size = OG_SIZE
export const contentType = 'image/png'

/** Prévia do link do canal: quem recebe pelo WhatsApp vê de qual empresa é. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const channel = await getChannel(slug)
  return new ImageResponse(
    <OgArt
      logo={await logoDataUrl()}
      kicker="Canal oficial de ouvidoria"
      title={channel.company.name}
      footer={`nossaouvidoria.com.br/${slug} · sigilo e acompanhamento por protocolo`}
    />,
    size,
  )
}

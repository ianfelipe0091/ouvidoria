import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Tamanho padrão das prévias de link (WhatsApp, redes, e-mail). */
export const OG_SIZE = { width: 1200, height: 630 }

/** O "Q" da marca como data URL, para desenhar dentro da imagem. */
export async function logoDataUrl() {
  const png = await readFile(join(process.cwd(), 'public/landing/logo-o.png'))
  return `data:image/png;base64,${png.toString('base64')}`
}

/**
 * Arte da prévia: faixa azul da marca, o "Q", um sobretítulo e o título.
 * Usada pela prévia do site e pela de cada canal de empresa.
 */
export function OgArt({ logo, kicker, title, footer }: { logo: string; kicker: string; title: string; footer: string }) {
  return (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: 72, background: 'linear-gradient(135deg, #3b3fd8 0%, #2a2cb0 100%)', color: 'white',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', background: 'white', borderRadius: 20, padding: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse só aceita <img> */}
          <img src={logo} width={52} height={51} alt="" />
        </div>
        <span style={{ fontSize: 34, fontWeight: 600 }}>Nossa Ouvidoria</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <span style={{ fontSize: 30, opacity: 0.8 }}>{kicker}</span>
        <span style={{ fontSize: title.length > 40 ? 58 : 72, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>{title}</span>
      </div>
      <span style={{ fontSize: 26, opacity: 0.75 }}>{footer}</span>
    </div>
  )
}

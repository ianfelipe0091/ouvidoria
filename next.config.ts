import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança de todas as respostas.
 *
 * CSP: scripts e estilos inline continuam liberados porque o Next injeta os
 * dados da página inline; exigir nonce obrigaria renderizar cada página por
 * requisição e perderíamos o cache da CDN na landing. O que a política corta é
 * o que importa num ataque: script de outro domínio, a página dentro de um
 * iframe alheio (clickjacking), plugins e formulários enviados para fora.
 * Imagens aceitam qualquer https porque o logo de cada empresa é uma URL dela.
 */
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // AVIF primeiro: nas fotos da landing rende arquivos bem menores que WebP,
    // com WebP como alternativa para navegadores que não aceitam AVIF.
    formats: ["image/avif", "image/webp"],
    // 75 é o padrão; 90 fica para as fotos da landing, que são réplica do
    // design de referência e não podem mostrar artefato de compressão.
    qualities: [75, 90],
    // As imagens da landing são versionadas pelo build — quando mudam, mudam de
    // URL. Não há motivo para o navegador revalidá-las.
    minimumCacheTTL: 31536000,
  },
};

export default nextConfig;

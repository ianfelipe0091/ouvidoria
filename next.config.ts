import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

import type { NextConfig } from 'next'

const securityHeaders = [
  // Impede que o browser adivinhe o tipo MIME — evita execução de arquivos como scripts
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Impede que a plataforma seja embutida em iframes de outros domínios (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Força HTTPS por 2 anos — browser nunca mais aceita HTTP para este domínio
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Não envia a URL completa como Referer para domínios externos
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restringe acesso a câmera, microfone e geolocalização
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig

import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const jost = Jost({
  subsets: ['latin'],
  weight: ['200', '300', '400'],
  variable: '--font-jost',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ConsultaViva — Consultoria Online',
  description: 'Plataforma de consultoria especializada com análise personalizada e sessões ao vivo com especialistas experientes.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${jost.variable}`}>
      {/*
        IMPORTANTE: sem classes Tailwind no <body>.
        Background, cor e fonte já estão definidos no globals.css via variáveis CSS.
        Aplicar classes aqui conflitaria com os CSS modules das páginas.
      */}
      <body>
        {children}
      </body>
    </html>
  )
}

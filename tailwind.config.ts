import type { Config } from 'tailwindcss'

/*
 * Tailwind é usado APENAS para utilitários de layout (flex, grid, gap, padding, etc).
 * Cores e fontes do projeto são gerenciadas pelas variáveis CSS em globals.css.
 * Não use classes de cor Tailwind (bg-*, text-*, border-*) nas páginas — use var(--*).
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config

import { Button } from '@react-email/components'

interface BotaoProps {
  href: string
  children: React.ReactNode
}

export function Botao({ href, children }: BotaoProps) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: '#c9a96e',
        color: '#ffffff',
        padding: '14px 28px',
        borderRadius: '6px',
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        fontWeight: 'bold',
        textDecoration: 'none',
        display: 'inline-block',
        margin: '16px 0',
      }}
    >
      {children}
    </Button>
  )
}
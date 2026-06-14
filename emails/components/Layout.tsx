import {
  Body, Container, Head, Html, Img,
  Preview, Section, Text, Hr, Link
} from '@react-email/components'

interface LayoutProps {
  preview: string
  children: React.ReactNode
}

export function Layout({ preview, children }: LayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>✦ ConsultaViva</Text>
          </Section>

          {/* Conteúdo */}
          <Section style={content}>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              ConsultaViva — Consultoria Online
            </Text>
            <Text style={footerText}>
              Dúvidas? Entre em contato:{' '}
              <Link href="mailto:contato@consultaviva.com.br" style={footerLink}>
                contato@consultaviva.com.br
              </Link>
            </Text>
            <Text style={footerSmall}>
              Você recebeu este e-mail porque possui cadastro na plataforma ConsultaViva.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body = {
  backgroundColor: '#f5f0eb',
  fontFamily: 'Georgia, serif',
}

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  overflow: 'hidden',
}

const header = {
  backgroundColor: '#2c1810',
  padding: '24px 32px',
  textAlign: 'center' as const,
}

const logo = {
  color: '#c9a96e',
  fontSize: '22px',
  fontWeight: 'bold',
  margin: '0',
  letterSpacing: '1px',
}

const content = {
  padding: '32px',
}

const hr = {
  borderColor: '#e8ddd4',
  margin: '0',
}

const footer = {
  padding: '24px 32px',
  backgroundColor: '#faf7f4',
}

const footerText = {
  color: '#8a7a6e',
  fontSize: '13px',
  margin: '4px 0',
  textAlign: 'center' as const,
}

const footerLink = {
  color: '#c9a96e',
}

const footerSmall = {
  color: '#b0a090',
  fontSize: '11px',
  margin: '12px 0 0',
  textAlign: 'center' as const,
}
import Link from 'next/link'

export const metadata = {
  title: 'Cadastro cancelado — ConsultaViva',
}

export default function CancelamentoConfirmado() {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@300;400;500&display=swap"
        rel="stylesheet"
      />
      <main style={{
        minHeight: '100svh',
        background: '#1a1410',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 24px',
        fontFamily: "'Jost', sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* brilho de fundo */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 50% 40% at 50% 0%, rgba(184,146,74,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* ícone */}
        <div style={{
          width: 56,
          height: 56,
          border: '1px solid rgba(184,146,74,0.35)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 32,
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M4 11l5 5 9-9" stroke="#b8924a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <span style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#b8924a',
          marginBottom: 16,
          display: 'block',
        }}>
          Cancelamento confirmado
        </span>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 'clamp(28px, 6vw, 46px)',
          fontWeight: 300,
          color: '#f5efe6',
          lineHeight: 1.15,
          marginBottom: 16,
          maxWidth: 480,
        }}>
          Seu cadastro foi<br />
          <em style={{ fontStyle: 'italic', color: '#d4a96a' }}>removido com sucesso</em>
        </h1>

        <p style={{
          fontSize: 15,
          color: 'rgba(245,239,230,0.4)',
          maxWidth: 380,
          lineHeight: 1.7,
          marginBottom: 40,
        }}>
          Seus dados foram excluídos da nossa plataforma. Nenhuma informação sua foi retida.
        </p>

        <Link href="/" style={{
          display: 'inline-block',
          background: '#b8924a',
          color: '#fff',
          fontFamily: "'Jost', sans-serif",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          padding: '16px 40px',
          textDecoration: 'none',
        }}>
          Voltar ao início
        </Link>
      </main>
    </>
  )
}

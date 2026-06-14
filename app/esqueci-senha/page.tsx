'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import '../cadastro/cadastro.css'

export default function EsqueciSenhaPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-senha`,
    })

    if (err) {
      setError('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="page" style={{ gridTemplateColumns: '1fr' }}>
      <div className="bg-glow" aria-hidden="true" />

      <main className="right" style={{ minHeight: '100dvh' }}>
        <div className="form-wrap">

          {sent ? (
            /* Estado: e-mail enviado */
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '48px',
                color: 'var(--gold)',
                marginBottom: '16px',
                lineHeight: 1
              }}>✦</p>
              <h1 className="form-title">E-mail enviado</h1>
              <p className="form-sub" style={{ marginBottom: '32px' }}>
                Verifique sua caixa de entrada em <strong style={{ color: 'var(--cream)' }}>{email}</strong>.
                O link expira em 1 hora.
              </p>
              <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '32px' }}>
                Não recebeu? Verifique a pasta de spam ou{' '}
                <button
                  onClick={() => setSent(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontSize: '12px', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                >
                  tente novamente
                </button>
                .
              </p>
              <a href="/cadastro" className="back-link">← Voltar para o login</a>
            </div>
          ) : (
            /* Estado: formulário */
            <>
              <a href="/" style={{ fontFamily: "'Cormorant SC', serif", fontSize: '18px', letterSpacing: '0.18em', color: 'var(--cream)', textDecoration: 'none', display: 'block', marginBottom: '48px' }}>
                Quiros
              </a>

              <p className="left-eyebrow" style={{ marginBottom: '12px' }}>Recuperar acesso</p>
              <h1 className="form-title">Esqueceu sua senha?</h1>
              <p className="form-sub" style={{ marginBottom: '36px' }}>
                Informe seu e-mail e enviaremos um link para criar uma nova senha.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="email">E-mail cadastrado</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(null) }}
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                {error && <div className="alert">{error}</div>}

                <button type="submit" className="btn-submit" disabled={loading}>
                  <span>{loading ? 'Enviando...' : 'Enviar link de recuperação'}</span>
                </button>
              </form>

              <a href="/cadastro" className="back-link" style={{ marginTop: '24px' }}>← Voltar para o login</a>
            </>
          )}

        </div>
      </main>
    </div>
  )
}

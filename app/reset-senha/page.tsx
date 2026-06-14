'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import '../cadastro/cadastro.css'

export default function ResetSenhaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  // O Supabase redireciona com um fragment #access_token=...
  // O cliente SSR troca isso por uma sessão automaticamente
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A senha deve ter ao menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError('Não foi possível atualizar a senha. O link pode ter expirado.')
    } else {
      setDone(true)
      setTimeout(() => router.push('/cadastro'), 3000)
    }
  }

  return (
    <div className="page" style={{ gridTemplateColumns: '1fr' }}>
      <div className="bg-glow" aria-hidden="true" />

      <main className="right" style={{ minHeight: '100dvh' }}>
        <div className="form-wrap">

          {done ? (
            /* Sucesso */
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '48px', color: 'var(--gold)', marginBottom: '16px', lineHeight: 1 }}>✦</p>
              <h1 className="form-title">Senha atualizada</h1>
              <p className="form-sub">Redirecionando para o login...</p>
            </div>

          ) : !ready ? (
            /* Aguardando token do Supabase */
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '48px', color: 'var(--gold-dk)', marginBottom: '16px', lineHeight: 1 }}>◌</p>
              <h1 className="form-title">Validando link...</h1>
              <p className="form-sub">Aguarde um momento.</p>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '24px', lineHeight: 1.7 }}>
                Se nada acontecer,{' '}
                <a href="/esqueci-senha" style={{ color: 'var(--gold)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  solicite um novo link
                </a>.
              </p>
            </div>

          ) : (
            /* Formulário de nova senha */
            <>
              <a href="/" style={{ fontFamily: "'Cormorant SC', serif", fontSize: '18px', letterSpacing: '0.18em', color: 'var(--cream)', textDecoration: 'none', display: 'block', marginBottom: '48px' }}>
                Quiros
              </a>

              <p className="left-eyebrow" style={{ marginBottom: '12px' }}>Nova senha</p>
              <h1 className="form-title">Redefinir senha</h1>
              <p className="form-sub" style={{ marginBottom: '36px' }}>
                Escolha uma senha segura com ao menos 8 caracteres.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="password">Nova senha</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null) }}
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="confirm">Confirmar nova senha</label>
                  <input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(null) }}
                    placeholder="Repita a senha"
                    required
                  />
                </div>

                {error && <div className="alert">{error}</div>}

                <button type="submit" className="btn-submit" disabled={loading}>
                  <span>{loading ? 'Salvando...' : 'Salvar nova senha'}</span>
                </button>
              </form>
            </>
          )}

        </div>
      </main>
    </div>
  )
}

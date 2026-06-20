'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { signUpSchema, signInSchema } from '@/lib/validation'
import './cadastro.css'
import { Suspense } from 'react'

type Mode = 'cadastro' | 'login'

 function CadastroInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('cadastro')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  })
  // ── Estados do fluxo de confirmação de e-mail ──
  const [emailSent, setEmailSent] = useState(false)
  const [emailSentTo, setEmailSentTo] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [confirmedSuccess, setConfirmedSuccess] = useState(false)

  // ── Detecta ?confirmed=true vindo do link do Supabase ──
    useEffect(() => {
    if (searchParams.get('confirmed') === 'true') {
      // Tenta redirecionar direto para triagem após confirmação
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.push('/dashboard/triagem')
        } else {
          setConfirmedSuccess(true)
          setMode('login')
        }
      })
    }
    if (searchParams.get('tab') === 'login') {
      setMode('login')
    }
  }, [searchParams])

  // ── Timer do cooldown de reenvio ──
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setError(null)
  }

  // ── Reenvio de e-mail de confirmação ──
  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return
    setResendCooldown(60)
    await supabase.auth.resend({ type: 'signup', email: emailSentTo })
  }, [resendCooldown, emailSentTo, supabase])

  
  async function salvarPerfil(userId: string) {
    const res = await fetch('/api/salvar-perfil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email: form.email,
        full_name: form.full_name,
        phone: form.phone,
      }),
    })
    const json = await res.json()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // ── Validação Zod ──
    if (mode === 'cadastro') {
      const parsed = signUpSchema.safeParse(form)
      if (!parsed.success) {
        const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Verifique os dados informados.'
        setError(first)
        return
      }
    } else {
      const parsed = signInSchema.safeParse(form)
      if (!parsed.success) {
        const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Verifique os dados informados.'
        setError(first)
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'cadastro') {
        const { data, error: err } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              full_name: form.full_name,
              phone: form.phone,
            },
            emailRedirectTo: `...`,
          },
        })

        if (err) throw err

        // E-mail duplicado silencioso
        if (data.user?.identities?.length === 0) {
          setError('Este e-mail já tem cadastro. Faça o login.')
          return
        }
       if (data.session){
        await salvarPerfil(data.user!.id)
        await new Promise(r => setTimeout(r, 1500))
        window.location.href = '/dashboard/triagem'     
        return
      }

      // Session nula mas usuário criado — faz login manual
      if (data.user && !data.session) {
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
        if (!loginErr) {
          await salvarPerfil(data.user.id)
          await new Promise(r => setTimeout(r, 1500))
          window.location.href = '/dashboard/triagem'
          return
        }
      }

        // ── Cadastro OK — exibe tela de confirmação ──
        setEmailSentTo(form.email)
        setEmailSent(true)
        setResendCooldown(60)

        // Dispara e-mail de boas-vindas (fire and forget)
        fetch('/api/enviar-boas-vindas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: form.full_name, email: form.email }),
        }).catch(() => {})

      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
        if (err) throw err

        router.refresh()
        // Se veio da confirmação de e-mail, vai para triagem
        const destino = searchParams.get('confirmed') === 'true' ? '/dashboard/triagem' : '/dashboard'
        router.push(destino)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado.'
      if (msg.includes('Invalid login credentials')) setError('E-mail ou senha incorretos.')
      else if (msg.includes('User already registered'))  setError('Este e-mail já tem cadastro. Faça o login.')
      else if (msg.includes('Email not confirmed'))      setError('Confirme seu e-mail antes de entrar.')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="bg-glow" aria-hidden="true" />
      
      <div className="cad-wrap">
        {/* ── TELA: Verifique seu e-mail ── */}
        {emailSent ? (
          <>
            <p className="cad-title">Verifique seu e-mail</p>
            <p className="cad-sub">
              Enviamos um link de confirmação para:
            </p>
            <p style={{ color: 'var(--gold)', fontFamily: 'var(--font-body)', fontSize: '15px', wordBreak: 'break-all' }}>
              {emailSentTo}
            </p>

            <div className="cad-alert" style={{ background: 'rgba(200,169,110,0.08)', borderColor: 'var(--border)', color: 'var(--primary-text)' }}>
              Abra seu e-mail e clique no link para ativar sua conta.<br />
              <span style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Não encontrou? Verifique a caixa de spam.
              </span>
            </div>

            <button
              className="btn-submit"
              onClick={handleResend}
              disabled={resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `Reenviar e-mail (${resendCooldown}s)`
                : 'Reenviar e-mail'}
            </button>

            <button
              className="back-link"
              onClick={() => { setEmailSent(false); setMode('login') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'center' }}
            >
              Já confirmei, quero entrar →
            </button>
          </>
        ) : (
          <>
            <p className="cad-title">
              {mode === 'cadastro' ? 'Criar conta' : 'Bem-vinda de volta'}
            </p>
            <p className="cad-sub">
              {mode === 'cadastro' ? 'Preencha os dados abaixo para começar' : 'Acesse sua área exclusiva'}
            </p>

            {/* ── Mensagem de sucesso após confirmar e-mail ── */}
            {confirmedSuccess && (
              <div className="cad-alert" style={{ background: 'rgba(200,169,110,0.08)', borderColor: 'var(--border)', color: 'var(--gold)' }}>
                ✓ E-mail confirmado com sucesso. Faça login para continuar.
              </div>
            )}

            <div className="tabs">
              <button className={`tab ${mode === 'cadastro' ? 'active' : ''}`}
                onClick={() => { setMode('cadastro'); setError(null); setConfirmedSuccess(false) }}
                type="button">
                Cadastro
              </button>
              <button className={`tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => { setMode('login'); setError(null) }}
                type="button">
                Entrar
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mode === 'cadastro' && (
  <div className="field">
    <label htmlFor="full_name">Nome completo</label>
    <input id="full_name" name="full_name" type="text"
      autoComplete="name" inputMode="text"
      value={form.full_name} onChange={handleChange}
      placeholder="Maria da Silva" required />
  </div>
)}

<div className="field">
  <label htmlFor="email">E-mail</label>
  <input id="email" name="email" type="email"
    autoComplete="email" inputMode="email"
    value={form.email} onChange={handleChange}
    placeholder="seu@email.com" required />
</div>

{mode === 'cadastro' && (
  <div className="field">
    <label htmlFor="phone">Telefone (WhatsApp)</label>
    <input id="phone" name="phone" type="tel"
      autoComplete="tel" inputMode="tel"
      value={form.phone} onChange={handleChange}
      placeholder="(11) 99999-9999" required />
  </div>
)}

<div className="field">
  <label htmlFor="password">Senha</label>
  <input id="password" name="password" type="password"
    autoComplete={mode === 'cadastro' ? 'new-password' : 'current-password'}
    value={form.password} onChange={handleChange}
    placeholder={mode === 'cadastro' ? 'Mínimo 8 caracteres' : '••••••••'}
    required />
  {mode === 'login' && (
    <div style={{ textAlign: 'right', marginTop: '6px' }}>
      <a href="/esqueci-senha" style={{
        fontSize: '11px', color: 'var(--muted)',
        letterSpacing: '0.08em', textDecoration: 'underline',
        textUnderlineOffset: '3px'
      }}>
        Esqueci minha senha
      </a>
    </div>
  )}
</div>

  {mode === 'cadastro' && (
    <div className="field">
      <label htmlFor="confirm_password">Confirmar senha</label>
      <input id="confirm_password" name="confirm_password" type="password"
        autoComplete="new-password"
        value={form.confirm_password} onChange={handleChange}
        placeholder="Repita a senha" required />
    </div>
  )}


              {error && <div className="cad-alert">{error}</div>}

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading
                  ? 'Aguarde...'
                  : mode === 'cadastro'
                  ? 'Criar conta gratuita'
                  : 'Entrar'}
              </button>
            </form>

            <a href="/" className="back-link">← Voltar para o início</a>
          </>
        )}

      </div>
    </div>
  )
}
export default function CadastroPage() {
  return(
    <Suspense>
      <CadastroInner />
    </Suspense>
  )
}
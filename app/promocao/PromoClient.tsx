'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import './promo.css'
import { createClient } from '@/lib/supabase'
import { VALOR_CONSULTA } from '@/lib/constants'
const supabase = createClient()

/* ─────────────── tipos ─────────────── */
interface PromoData {
  id: string
  limite: number
  usadas: number
  expira_em: string
}

interface Props {
  promo: PromoData
}

interface FormState {
  full_name: string
  email: string
  phone: string
  password: string
  confirm_password: string
  hand_dominance: 'destro' | 'canhoto' | ''
}

interface FormErrors {
  full_name?: string
  email?: string
  phone?: string
  password?: string
  confirm_password?: string
  hand_dominance?: string
  global?: string
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!form.full_name.trim() || form.full_name.trim().split(' ').length < 2)
    errors.full_name = 'Informe seu nome completo.'

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRe.test(form.email))
    errors.email = 'Informe um e-mail válido.'

  const phoneDigits = form.phone.replace(/\D/g, '')
  if (phoneDigits.length < 10 || phoneDigits.length > 11)
    errors.phone = 'Informe um WhatsApp válido com DDD.'

  if (form.password.length < 6)
    errors.password = 'A senha deve ter pelo menos 6 caracteres.'

  if (form.confirm_password !== form.password)
    errors.confirm_password = 'As senhas não coincidem.'

  if (!form.hand_dominance)
    errors.hand_dominance = 'Selecione sua lateralidade.'

  return errors
}

/* ─────────────── Ornamento decorativo ─────────────── */
function OrnamentSvg() {
  return (
    <svg className="hero-hand" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="80" r="55" stroke="rgba(184,146,74,0.15)" strokeWidth="0.8" fill="none"/>
      <circle cx="60" cy="80" r="40" stroke="rgba(184,146,74,0.3)" strokeWidth="0.8" fill="none"/>
      <circle cx="60" cy="80" r="24" stroke="rgba(184,146,74,0.5)" strokeWidth="1" fill="none"/>
      <circle cx="60" cy="80" r="6" stroke="rgba(184,146,74,0.6)" strokeWidth="1" fill="none"/>
      <path d="M60 22 L60 138" stroke="rgba(184,146,74,0.2)" strokeWidth="0.7" strokeDasharray="3 3" fill="none"/>
      <path d="M3 80 L117 80" stroke="rgba(184,146,74,0.2)" strokeWidth="0.7" strokeDasharray="3 3" fill="none"/>
      <path d="M19 39 L101 121" stroke="rgba(184,146,74,0.15)" strokeWidth="0.7" strokeDasharray="3 3" fill="none"/>
      <path d="M101 39 L19 121" stroke="rgba(184,146,74,0.15)" strokeWidth="0.7" strokeDasharray="3 3" fill="none"/>
    </svg>
  )
}

/* ─────────────── componente principal ─────────────── */
export default function PromoClient({ promo }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLDivElement>(null)

  const vagasRestantes = Math.max(0, promo.limite - promo.usadas)

  const [form, setForm] = useState<FormState>({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    hand_dominance: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  /* scroll reveal */
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('visible'), i * 80)
            obs.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    const parsed = name === 'phone' ? formatPhone(value) : value
    setForm(prev => ({ ...prev, [name]: parsed }))
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  const validation = validateForm(form)
  if (Object.keys(validation).length > 0) {
    setErrors(validation)
    return
  }

  setLoading(true)
  setErrors({})

  try {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.full_name.trim() },
      },
    })

    if (signUpError) {
      setErrors({ global: 'Ocorreu um erro ao criar sua conta. Tente novamente.' })
      return
    }

    if (data.user?.identities?.length === 0) {
      setErrors({ global: 'Este e-mail já está cadastrado. Tente fazer login.' })
      return
    }

    // Se não veio sessão, faz login manual primeiro
    if (data.user && !data.session) {
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      })
      if (loginErr) {
        setErrors({ global: 'Conta criada, mas não foi possível entrar. Tente fazer login.' })
        return
      }
    }

    // Salva perfil completo
    const res = await fetch('/api/promo/perfil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: data.user!.id,
        phone: form.phone,
        hand_dominance: form.hand_dominance,
        promo_id: promo.id,
      }),
    })

    if (!res.ok) {
      console.error('Erro ao salvar perfil:', await res.text())
    }

    // Dispara e-mail de boas-vindas
    fetch('/api/enviar-boas-vindas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: form.full_name.trim(), email: form.email.trim() }),
    }).catch(() => {})

    await new Promise(r => setTimeout(r, 1500))
    window.location.href = '/dashboard/triagem'

  } catch {
    setErrors({ global: 'Erro inesperado. Verifique sua conexão e tente novamente.' })
  } finally {
    setLoading(false)
  }
}

  return (
    <>
      {/* ── GOOGLE FONTS ── */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      {/* ── HERO ── */}
      <section className="hero">
        <OrnamentSvg />

        <span className="hero-tag">Por tempo limitado · Gratuito</span>
        <span className="hero-badge">Consultoria Especializada · Análise Personalizada</span>

        <h1>
          Descubra o que<br />
          a análise <em>revela sobre você</em>
        </h1>

        <p className="hero-sub">
          Cadastre-se, envie seus materiais e receba sua análise
          personalizada — sem custo
        </p>

        <div className="hero-cta">
          <a href="#cadastro" className="btn-primary">
            Quero minha análise gratuita
          </a>
          <span className="hero-disclaimer">100% gratuito · Sem cartão de crédito</span>
        </div>

        {vagasRestantes > 0 && (
          <div className="hero-slots">
            <span className="hero-slots-dot" />
            <span>
              {vagasRestantes === 1
                ? 'Apenas 1 vaga restante'
                : `Apenas ${vagasRestantes} vagas restantes`}
            </span>
          </div>
        )}
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="how">
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">Como funciona</span>
            <h2 className="section-title">
              Simples assim,<br /><em>em três passos</em>
            </h2>
          </div>

          <div className="steps reveal">
            <div className="step">
              <div className="step-num">01</div>
              <h3 className="step-title">Faça seu cadastro</h3>
              <p className="step-desc">Preencha um formulário rápido com seus dados básicos. Leva menos de dois minutos.</p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h3 className="step-title">Envie seus materiais</h3>
              <p className="step-desc">Você receberá o guia completo de como enviar os materiais necessários para a análise.</p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h3 className="step-title">Receba sua análise</h3>
              <p className="step-desc">Sua análise personalizada fica disponível diretamente na plataforma, feita pela nossa especialista.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── O QUE VOCÊ DESCOBRE ── */}
      <section className="what">
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">O que você vai descobrir</span>
            <h2 className="section-title">
              A análise revela<br /><em>quem você realmente é</em>
            </h2>
          </div>

          <div className="what-grid reveal">
            <div className="what-card">
              <div className="what-line" />
              <h3 className="what-title">Personalidade</h3>
              <p className="what-desc">Como você age, sente e se relaciona com o mundo. Seus pontos fortes e os padrões que se repetem na sua vida.</p>
            </div>
            <div className="what-card">
              <div className="what-line" />
              <h3 className="what-title">Emoções</h3>
              <p className="what-desc">Sua forma de amar, de se conectar com as pessoas e como você lida com seus sentimentos mais profundos.</p>
            </div>
            <div className="what-card">
              <div className="what-line" />
              <h3 className="what-title">Potencial</h3>
              <p className="what-desc">O que a análise indica sobre seus talentos naturais, seu caminho e as possibilidades à sua frente.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FORMULÁRIO DE CADASTRO ── */}
      <section className="register" id="cadastro">
        <div className="register-card reveal" ref={formRef}>
          <span className="section-label">Cadastro gratuito</span>
          <h2 className="register-title">
            Receba sua<br /><em>análise grátis</em>
          </h2>
          <p className="register-sub">
            Preencha abaixo e em instantes você estará dentro da plataforma,
            pronto(a) para iniciar sua análise.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* nome completo */}
            <div className="form-group">
              <label htmlFor="full_name">Seu nome completo</label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="Como você se chama?"
                value={form.full_name}
                onChange={handleChange}
                className={errors.full_name ? 'error' : ''}
                autoComplete="name"
              />
              {errors.full_name && <p className="field-error">{errors.full_name}</p>}
            </div>

            {/* e-mail */}
            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
                autoComplete="email"
              />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>

            {/* whatsapp */}
            <div className="form-group">
              <label htmlFor="phone">WhatsApp (com DDD)</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={form.phone}
                onChange={handleChange}
                className={errors.phone ? 'error' : ''}
                autoComplete="tel"
                inputMode="numeric"
              />
              {errors.phone && <p className="field-error">{errors.phone}</p>}
            </div>

            {/* mão dominante */}
            <div className="form-group">
              <label htmlFor="hand_dominance">Você é destro ou canhoto?</label>
              <select
                id="hand_dominance"
                name="hand_dominance"
                value={form.hand_dominance}
                onChange={handleChange}
                className={errors.hand_dominance ? 'error' : ''}
              >
                <option value="" disabled>Selecione</option>
                <option value="destro">Destro</option>
                <option value="canhoto">Canhoto</option>
              </select>
              {errors.hand_dominance && <p className="field-error">{errors.hand_dominance}</p>}
            </div>

            <hr className="form-divider" />

            {/* senha */}
            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
                autoComplete="new-password"
              />
              {errors.password && <p className="field-error">{errors.password}</p>}
            </div>

            {/* confirmar senha */}
            <div className="form-group">
              <label htmlFor="confirm_password">Confirmar senha</label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                placeholder="Repita a senha"
                value={form.confirm_password}
                onChange={handleChange}
                className={errors.confirm_password ? 'error' : ''}
                autoComplete="new-password"
              />
              {errors.confirm_password && <p className="field-error">{errors.confirm_password}</p>}
            </div>

            <hr className="form-divider" />

            <div className="photo-note">
              <p>
                <strong>O que acontece depois:</strong> você entra direto na plataforma onde nossa
                especialista irá guiá-la pelo processo de envio dos materiais e realizar sua análise personalizada.
              </p>
            </div>

            {errors.global && (
              <div className="form-error-global">{errors.global}</div>
            )}

            <button
              type="submit"
              className="btn-register"
              disabled={loading}
            >
              {loading ? 'Criando sua conta...' : 'Quero minha análise gratuita'}
            </button>

            <p className="form-terms">
              Seus dados são usados apenas para a realização da análise. Nada de spam.
            </p>
          </form>
        </div>
      </section>

      {/* ── UPGRADE ── */}
      <section className="upgrade">
        <div className="container-sm">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">Quer ir mais fundo?</span>
            <h2 className="section-title" style={{ color: 'var(--parchment)' }}>
              Uma consulta completa,<br /><em>ao vivo com a especialista</em>
            </h2>
            <p className="upgrade-intro">
              Depois de receber sua análise gratuita, você pode agendar uma sessão individual
              de 30 minutos — ao vivo, com atenção total só para você.
            </p>
          </div>

          <div className="upgrade-card reveal">
            <span className="upgrade-label">Consulta individual</span>
            <h3 className="upgrade-title">Análise <em>completa</em></h3>
            <p className="upgrade-sub">Ao vivo via chat com a especialista</p>
            <div className="upgrade-price"><sup>R$</sup>{VALOR_CONSULTA}</div>
            <span className="upgrade-duration">sessão de 30 minutos</span>

            <ul className="upgrade-features">
              <li>Análise detalhada do seu perfil comportamental</li>
              <li>Diagnóstico personalizado baseado nos seus materiais</li>
              <li>Insights sobre carreira, relacionamentos e saúde emocional</li>
              <li>Espaço para suas perguntas durante a consulta</li>
            </ul>

            <a href="#cadastro" className="btn-primary">
              Começar pela análise gratuita
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <p>ConsultaViva · Atendimento online</p>
      </footer>
    </>
  )
}

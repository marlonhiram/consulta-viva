'use client'

import { useState, useEffect } from 'react'
import { TESTE_PRODUTO, VALOR_CONSULTA_FORMATADO } from '@/lib/constants'
import './landing.css'

const TESTIMONIALS = [
  { text: 'A consultoria foi cirúrgica. Ela descreveu padrões que eu nunca tinha conseguido nomear em anos de terapia. Completamente transformador.', author: 'Ana Paula M. — São Paulo' },
  { text: 'Fiz a consulta premium com ceticismo e saí com um plano de vida. A precisão da análise foi algo que não consigo explicar racionalmente.', author: 'Fernanda R. — Rio de Janeiro' },
  { text: 'Indico para todas as minhas amigas. Não é misticismo, é análise — e a profundidade do que ela enxerga é impressionante.', author: 'Camila T. — Curitiba' },
]

const CARDS = [
  { num: '01', title: 'Autoconhecimento & Identidade' },
  { num: '02', title: 'Propósito & Direção' },
  { num: '03', title: 'Decisões & Próximos Passos' },
]

export default function LandingClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [closing, setClosing] = useState(false)

  const ctaHref   = isLoggedIn ? '/dashboard' : '/cadastro'
  const ctaLabel  = isLoggedIn ? 'Acessar minha área' : 'Receber análise gratuita'

  function openSheet() { setSheetOpen(true); setClosing(false) }
  function closeSheet() {
    setClosing(true)
    setTimeout(() => { setSheetOpen(false); setClosing(false) }, 220)
  }

  // Fecha com Escape
  useEffect(() => {
    if (!sheetOpen) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSheet() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen])

  // Trava scroll do body quando sheet está aberta
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sheetOpen])

  return (
    <>
      <div className="bg-glow" aria-hidden="true" />

      {TESTE_PRODUTO && (
        <div className="teste-produto-banner" role="status">
          ⚠ Ambiente de teste de produto — cobranças e agendamentos são simulações, sem prestação real de serviço.
        </div>
      )}

      {/* ── NAV ── */}
      <nav className="nav">
        <a href="/" className="nav-logo">ConsultaViva</a>
        {/* Entrar — visível em mobile e desktop */}
        {!isLoggedIn && (
          <a href="/cadastro?tab=login" className="nav-entrar">Entrar</a>
        )}
        {/* CTA só aparece no desktop via CSS */}
        <a href={ctaHref} className="nav-desktop-cta">{ctaLabel}</a>
      </nav>

      {/* ── CONTEÚDO ── */}
      <main className="main">

        {/* Hero */}
        <section className="hero">
          <p className="eyebrow">Consultoria Online</p>
          <h1 className="hero-title">
            Conecte-se com um <em>especialista</em><br />que entende você
          </h1>
          <p className="hero-sub">Mais de 38 anos de experiência</p>
          <p className="hero-body">
            Uma análise especializada transforma sua situação em
            um diagnóstico comportamental preciso.
          </p>

          {/* CTA só aparece aqui no desktop */}
          <div className="hero-cta-desktop">
            <a href={ctaHref} className="btn-primary">
              <span>{ctaLabel}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 7h12M8 3l5 4-5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a href="#sobre" className="btn-secondary-link">Saiba mais</a>
          </div>
        </section>

        <div className="divider">
          <div className="divider-line" />
          <span className="divider-dot">✦</span>
          <div className="divider-line" />
        </div>

        {/* Cards */}
        <section className="cards-section" id="sobre">
          <p className="cards-label">A análise revela</p>
          <div className="cards-grid">
            {CARDS.map(card => (
              <div key={card.num} className="card">
                <div className="card-left">
                  <span className="card-num">{card.num}</span>
                  <span className="card-title">{card.title}</span>
                </div>
                <span className="card-arrow">›</span>
              </div>
            ))}
          </div>
        </section>

        <div className="divider">
          <div className="divider-line" />
          <span className="divider-dot">✦</span>
          <div className="divider-line" />
        </div>

        {/* Autoridade */}
        <section className="authority" id="especialista">
          <blockquote className="authority-quote">
            Cada pessoa carrega uma história única — e em cada
            detalhe existe uma linguagem que poucos sabem interpretar com rigor analítico.
          </blockquote>
          <div className="authority-sig">
            <strong>Especialista em Consultoria Comportamental</strong>
            Mais de 38 anos · Milhares de análises realizadas
          </div>
        </section>

        {/* Botão depoimentos */}
        <div className="testimonials-section">
          <button className="btn-testimonials" onClick={openSheet}>
            <span className="btn-testimonials-icon">★</span>
            Ver depoimentos
          </button>
        </div>

        {/* CTA Final */}
        <section className="final-cta">
          <p className="final-label">Comece agora</p>
          <h2 className="final-title">Sua análise gratuita<br />está esperando</h2>
          <p className="final-sub">Sem compromisso. Sem cartão.</p>
          <div className="price-badge">
            Consulta premium a partir de <strong>{VALOR_CONSULTA_FORMATADO}</strong>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <span className="footer-logo">ConsultaViva</span>
          <span className="footer-text">© 2026 ConsultaViva</span>
          <span className="footer-seal">🔒 Ambiente seguro e privado</span>
        </footer>

      </main>

      {/* ── STICKY CTA — mobile only ── */}
      <div className="sticky-cta">
        <a href={ctaHref} className="btn-primary">
          <span>{ctaLabel}</span>
        </a>
        <a href="#sobre" className="btn-ghost">↓</a>
      </div>

      {/* ── BOTTOM SHEET — depoimentos ── */}
      {sheetOpen && (
        <>
          <div
            className={`sheet-overlay${closing ? ' closing' : ''}`}
            onClick={closeSheet}
            aria-hidden="true"
          />
          <div
            className={`sheet${closing ? ' closing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Depoimentos"
          >
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h2 className="sheet-title">O que dizem nossos clientes</h2>
              <button className="sheet-close" onClick={closeSheet} aria-label="Fechar">×</button>
            </div>
            <div className="sheet-body">
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="testimonial-item">
                  <p className="testimonial-text">{t.text}</p>
                  <p className="testimonial-author">{t.author}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}

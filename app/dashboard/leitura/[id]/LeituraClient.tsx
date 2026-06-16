'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { VALOR_CONSULTA, VALOR_CONSULTA_FORMATADO } from '@/lib/constants'
import './leitura.css'

interface Props {
  analysis: string
  createdAt: string
  consultationId: string
  userEmail: string
  userName: string
  creditoDisponivel: boolean
  tipo: string | null   // ← novo: 'gratuita' | 'premium'
}

function ModalPix({ consultationId, userEmail, userName, onClose, onPago }: {
  consultationId: string
  userEmail: string
  userName: string
  onClose: () => void
  onPago: () => void
}) {
  const [step, setStep] = useState<'loading' | 'qr' | 'confirmado' | 'erro'>('loading')
  const [pixCopiaECola, setPixCopiaECola] = useState('')
  const [qrCodeBase64, setQrCodeBase64] = useState('')
  const [copiado, setCopiado] = useState(false)
  const supabase = createClient()

  const gerarPix = useCallback(async () => {
    setStep('loading')
    try {
      const res = await fetch('/api/pagamento/criar-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId, userEmail, userName }),
      })
      const data = await res.json()
      if (!res.ok) { setStep('erro'); return }
      setPixCopiaECola(data.pixCopiaECola)
      setQrCodeBase64(data.qrCodeBase64)
      setStep('qr')
    } catch { setStep('erro') }
  }, [consultationId, userEmail, userName])

  useEffect(() => { gerarPix() }, [gerarPix])

  useEffect(() => {
    if (step !== 'qr') return
    const channel = supabase
      .channel(`payment-${consultationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payments',
        filter: `consultation_id=eq.${consultationId}`,
      },
        (payload) => {
          if (payload.new.status === 'paid') {
            setStep('confirmado')
            setTimeout(() => onPago(), 2000)
          }
        }
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [step, consultationId, supabase, onPago])

  async function copiarPix() {
    try {
      await navigator.clipboard.writeText(pixCopiaECola)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    } catch {}
  }

  return (
    <div className="leitura-modal-overlay" onClick={onClose}>
      <div className="leitura-modal-box" onClick={e => e.stopPropagation()}>
        <div className="leitura-modal-header">
          <span className="leitura-modal-title">Consulta Premium · {VALOR_CONSULTA_FORMATADO}</span>
          <button className="leitura-modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '24px' }}>
          {step === 'loading' && <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Gerando seu PIX...</p>}
          {step === 'qr' && (
            <>
              <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>
                Escaneie o QR Code ou copie o código PIX. Após o pagamento, sua consulta será liberada automaticamente.
              </p>
              {qrCodeBase64 && (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR Code PIX" style={{ width: '200px', height: '200px' }} />
                </div>
              )}
              <button className="leitura-btn-cta" onClick={copiarPix}>
                {copiado ? '✓ Código copiado!' : 'Copiar código PIX'}
              </button>
              <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '12px' }}>
                Aguardando confirmação do pagamento...
              </p>
            </>
          )}
          {step === 'confirmado' && (
            <>
              <p style={{ textAlign: 'center', fontSize: '32px' }}>✦</p>
              <p style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--dark)' }}>
                Pagamento confirmado!
              </p>
              <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
                Seu crédito está disponível. Agora você pode agendar sua consulta.
              </p>
            </>
          )}
          {step === 'erro' && (
            <>
              <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Erro ao gerar o PIX. Tente novamente.</p>
              <button className="leitura-btn-cta" onClick={gerarPix}>Tentar novamente</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LeituraClient({
  analysis,
  createdAt,
  consultationId,
  userEmail,
  userName,
  creditoDisponivel,
  tipo,
}: Props) {
  const router = useRouter()
  const [modalPix, setModalPix] = useState(false)
  const [leituraAberta, setLeituraAberta] = useState(false)

  const isPremiumConcluida = tipo === 'premium'

  const dataFormatada = new Date(createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })

  const paragrafos = analysis.split('\n').filter(Boolean)

  return (
    <>
      {modalPix && (
        <ModalPix
          consultationId={consultationId}
          userEmail={userEmail}
          userName={userName}
          onClose={() => setModalPix(false)}
          onPago={() => {
            setModalPix(false)
            router.push(`/dashboard/agendar/${consultationId}`)
          }}
        />
      )}

      <div className="leitura-root">

        {/* Header */}
        <header className="leitura-header">
          <button className="leitura-back" onClick={() => router.push('/dashboard')}>
            ← Voltar
          </button>
          <span className="leitura-logo">Quiros</span>
          <div style={{ width: '60px' }} />
        </header>

        <main className="leitura-main">

          {/* Topo */}
          <div className="leitura-topo">
            <p className="leitura-eyebrow">Consultoria Online</p>
            <h1 className="leitura-titulo">Sua Análise</h1>
            <p className="leitura-data">Elaborada em {dataFormatada}</p>
          </div>

          {/* Divisor ornamental */}
          <div className="leitura-divisor">
            <span className="leitura-ornamento">✦</span>
          </div>

          {/* Card da leitura */}
          <div className={`leitura-cta${isPremiumConcluida ? ' leitura-cta--sem-cta' : ''}`}>

            {/* Texto da análise */}
            <div className={`leitura-texto-wrap${leituraAberta ? ' aberta' : ''}`}>
              <article className="leitura-texto">
                {paragrafos.map((p, i) => (
                  <p key={i} className="leitura-paragrafo">{p}</p>
                ))}
              </article>

              {!leituraAberta && (
                <div className="leitura-fade">
                  <button
                    className="leitura-btn-revelar"
                    onClick={() => setLeituraAberta(true)}
                  >
                    Mostrar mais ↓
                  </button>
                </div>
              )}
            </div>

            {/* CTA — escondido para consultas premium já concluídas */}
            {!isPremiumConcluida && (
              <>
                {leituraAberta && (
                  <div className="leitura-divisor-interno">
                    <span className="leitura-ornamento">◈</span>
                  </div>
                )}

                <p className="leitura-cta-eyebrow">O próximo passo</p>
                <h2 className="leitura-cta-titulo">
                  Sua leitura revelou padrões únicos
                </h2>
                <p className="leitura-cta-texto">
                  A análise que você acabou de ler é apenas uma introdução ao que as
                  suas mãos revelam. Em uma consulta ao vivo de 30 minutos, nossa
                  especialista aprofunda cada traço da sua personalidade, responde
                  suas dúvidas e entrega uma leitura personalizada e interativa —
                  uma experiência que vai além do texto.
                </p>

                <div className="leitura-cta-beneficios">
                  <div className="leitura-beneficio">
                    <span className="beneficio-icon">✦</span>
                    <span>30 minutos de atenção exclusiva</span>
                  </div>
                  <div className="leitura-beneficio">
                    <span className="beneficio-icon">✦</span>
                    <span>Análise aprofundada das suas linhas</span>
                  </div>
                  <div className="leitura-beneficio">
                    <span className="beneficio-icon">✦</span>
                    <span>Respostas para suas dúvidas em tempo real</span>
                  </div>
                  <div className="leitura-beneficio">
                    <span className="beneficio-icon">✦</span>
                    <span>Orientações práticas para sua vida</span>
                  </div>
                </div>

                <div className="leitura-cta-preco">
                  <span className="preco-valor">R${VALOR_CONSULTA}</span>
                  <span className="preco-desc">sessão única · 30 minutos · ao vivo</span>
                </div>

                {!creditoDisponivel ? (
                  <button className="leitura-btn-cta" onClick={() => setModalPix(true)}>
                    Adquirir Consulta Premium — R$ {VALOR_CONSULTA}
                  </button>
                ) : (
                  <button className="leitura-btn-cta" onClick={() => router.push(`/dashboard/agendar/${consultationId}`)}>
                    Agendar minha Consulta →
                  </button>
                )}

                <p className="leitura-cta-rodape">
                  Vagas limitadas · Agendamento imediato
                </p>
              </>
            )}
          </div>

        </main>

        <footer className="leitura-footer">
          <p>Quiros · Quirologia Analítica</p>
        </footer>

      </div>
    </>
  )
}
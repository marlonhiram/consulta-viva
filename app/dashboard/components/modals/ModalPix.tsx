'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { VALOR_CONSULTA_FORMATADO } from '@/lib/constants'

/* ─── Modal PIX ─────────────────────────────────────────────────────────── */

export function ModalPix({
  consultationId,
  userEmail,
  userName,
  onClose,
  onPago,
}: {
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
        body: JSON.stringify({ consultationId }),
      })
      const data = await res.json()
      if (!res.ok) { setStep('erro'); return }
      setPixCopiaECola(data.pixCopiaECola)
      setQrCodeBase64(data.qrCodeBase64)
      setStep('qr')
    } catch {
      setStep('erro')
    }
  }, [consultationId, userEmail, userName])

  useEffect(() => { gerarPix() }, [gerarPix])

  useEffect(() => {
    if (step !== 'qr') return

    // Realtime — dispara imediatamente se o evento chegar
    const channel = supabase
      .channel(`payment-${consultationId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payments', filter: `consultation_id=eq.${consultationId}` },
        (payload) => { if (payload.new.status === 'paid') { setStep('confirmado'); setTimeout(() => onPago(), 2000) } }
      ).subscribe()

    // Polling a cada 4s como fallback — garante atualização mesmo se o Realtime perder o evento
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('payments')
        .select('status')
        .eq('consultation_id', consultationId)
        .single()
      if (data?.status === 'paid') {
        setStep('confirmado')
        setTimeout(() => onPago(), 2000)
      }
    }, 4000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [step, consultationId, supabase, onPago])

  async function copiarPix() {
    try { await navigator.clipboard.writeText(pixCopiaECola); setCopiado(true); setTimeout(() => setCopiado(false), 3000) } catch {}
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--pix" onClick={e => e.stopPropagation()}>
        {step === 'loading' && (
          <>
            <div className="modal-eyebrow">Consulta Premium</div>
            <h2 className="modal-title">Gerando seu PIX...</h2>
            <div className="pix-loading"><div className="pix-spinner" /><p className="pix-loading-text">Conectando ao Mercado Pago</p></div>
          </>
        )}
        {step === 'qr' && (
          <>
            <div className="modal-eyebrow">Consulta Premium · {VALOR_CONSULTA_FORMATADO}</div>
            <h2 className="modal-title">Pague via PIX</h2>
            <p className="modal-desc">Escaneie o QR Code abaixo ou copie o código PIX. Após o pagamento, sua consulta será liberada automaticamente.</p>
            {qrCodeBase64 && <div className="pix-qr-wrap"><img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR Code PIX" className="pix-qr-img" /></div>}
            <button className="pix-copiar-btn" onClick={copiarPix}>{copiado ? '✓ Código copiado!' : 'Copiar código PIX'}</button>
            <div className="pix-info"><span className="pix-info-dot" />Aguardando confirmação do pagamento...</div>
            <p className="pix-validade">O PIX expira em 30 minutos · Pagamento processado pelo Mercado Pago</p>
          </>
        )}
        {step === 'confirmado' && (
          <>
            <div className="pix-sucesso-icon">✦</div>
            <div className="modal-eyebrow">Pagamento confirmado</div>
            <h2 className="modal-title">Crédito disponível!</h2>
            <p className="modal-desc">Seu pagamento foi confirmado. Agora você pode agendar sua consulta no melhor horário para você.</p>
          </>
        )}
        {step === 'erro' && (
          <>
            <div className="modal-eyebrow">Erro</div>
            <h2 className="modal-title">Não foi possível gerar o PIX</h2>
            <p className="modal-desc">Ocorreu um erro ao conectar com o Mercado Pago. Tente novamente.</p>
            <button className="btn-primary btn-primary--lg" onClick={gerarPix}>Tentar novamente</button>
          </>
        )}
        <button className="modal-cancel" onClick={onClose}>{step === 'confirmado' ? 'Fechar' : 'Cancelar'}</button>
      </div>
    </div>
  )
}

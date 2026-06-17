'use client'
import { useState } from 'react'
import { VALOR_CONSULTA_FORMATADO } from '@/lib/constants'

/* ─── Modal Cancelar Consulta ───────────────────────────────────────────── */

export function ModalCancelarConsulta({
  consultationId,
  onClose,
  onCancelado,
}: {
  consultationId: string
  onClose: () => void
  onCancelado: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleCancelar() {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/cancelar-consulta-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao cancelar.'); return }
      onCancelado()
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-eyebrow">Cancelamento</div>
        <h2 className="modal-title">Cancelar consulta?</h2>
        <p className="modal-desc">
          Ao cancelar, um crédito de <strong>{VALOR_CONSULTA_FORMATADO}</strong> será gerado automaticamente
          e ficará disponível para novo agendamento. Você também pode solicitar
          reembolso em dinheiro após o cancelamento.
        </p>
        {erro && <p className="modal-erro">{erro}</p>}
        <button className="btn-primary btn-primary--lg btn-primary--danger" onClick={handleCancelar} disabled={loading}>
          {loading ? 'Cancelando...' : 'Confirmar cancelamento'}
        </button>
        <button className="modal-cancel" onClick={onClose}>Voltar</button>
      </div>
    </div>
  )
}

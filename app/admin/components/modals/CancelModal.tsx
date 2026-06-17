'use client'
import { useState } from 'react'
import { VALOR_CONSULTA_FORMATADO } from '@/lib/constants'

/* ─────────────────────────────────────────────
   MODAL CANCELAR (ESPECIALISTA)
───────────────────────────────────────────── */

export function CancelModal({ clientName, onClose, onConfirm }: { clientName: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (reason.trim().length < 10) return
    setLoading(true)
    await onConfirm(reason.trim())
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__icon">🚫</div>
        <h2 className="modal__title">Cancelar consulta de {clientName}?</h2>
        <p className="modal__text">O cliente receberá um crédito de <strong>{VALOR_CONSULTA_FORMATADO}</strong> automaticamente.</p>
        <textarea className="modal__textarea" placeholder="Motivo do cancelamento..." value={reason} onChange={e => setReason(e.target.value)} rows={4} />
        <p className="modal__char-hint">{reason.trim().length < 10 ? `Mínimo 10 caracteres (${reason.trim().length}/10)` : `${reason.trim().length} caracteres`}</p>
        <div className="modal__actions">
          <button className="modal__btn-primary" style={{ background: 'var(--danger)', color: '#fff' }} onClick={handleConfirm} disabled={reason.trim().length < 10 || loading}>
            {loading ? 'Cancelando...' : '🚫 Confirmar Cancelamento'}
          </button>
          <button className="modal__btn-secondary" onClick={onClose} disabled={loading}>Voltar</button>
        </div>
      </div>
    </div>
  )
}

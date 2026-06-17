'use client'
import { useState } from 'react'

/* ─────────────────────────────────────────────
   MODAL RECUSAR FOTOS
───────────────────────────────────────────── */

export function RefuseModal({ clientName, onClose, onConfirm }: { clientName: string; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__icon">❌</div>
        <h2 className="modal__title">Recusar as fotos de {clientName}?</h2>
        <p className="modal__text">Explique o motivo. A cliente poderá enviar novas fotos.</p>
        <textarea className="modal__textarea" placeholder="Ex: As fotos estão muito escuras..." value={reason} onChange={e => setReason(e.target.value)} rows={4} />
        <div className="modal__actions">
          <button className="modal__btn-primary" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => onConfirm(reason)} disabled={reason.trim().length < 10}>
            ❌ Confirmar Recusa
          </button>
          <button className="modal__btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

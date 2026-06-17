'use client'
import { useState } from 'react'
import type { AgendaBlock } from '../../types'

/* ─────────────────────────────────────────────
   MODAL BLOQUEAR HORÁRIO
───────────────────────────────────────────── */

export function BlockModal({ onClose, onSave }: { onClose: () => void; onSave: (block: Omit<AgendaBlock, 'id'>) => void }) {
  const [date, setDate] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [reason, setReason] = useState('')
  const [allDay, setAllDay] = useState(true)

  const handleSave = () => {
    if (!date) return
    const starts = allDay
      ? new Date(`${date}T00:00:00-03:00`).toISOString()
      : new Date(`${date}T${timeStart}:00-03:00`).toISOString()
    const ends = allDay
      ? new Date(`${date}T23:59:00-03:00`).toISOString()
      : new Date(`${date}T${timeEnd}:00-03:00`).toISOString()
    onSave({ starts_at: starts, ends_at: ends, reason, type: 'bloqueado' })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__icon">🚫</div>
        <h2 className="modal__title">Bloquear Horário na Agenda</h2>
        <p className="modal__text">Clientes não poderão agendar neste horário.</p>
        <div className="modal__field">
          <label className="modal__label">Data</label>
          <input type="date" className="modal__input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="modal__field">
          <label className="modal__label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} style={{ width: 20, height: 20 }} />
            Bloquear o dia inteiro
          </label>
        </div>
        {!allDay && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="modal__field">
              <label className="modal__label">Das</label>
              <input type="time" className="modal__input" value={timeStart} onChange={e => setTimeStart(e.target.value)} />
            </div>
            <div className="modal__field">
              <label className="modal__label">Até</label>
              <input type="time" className="modal__input" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} />
            </div>
          </div>
        )}
        <div className="modal__field">
          <label className="modal__label">Motivo (opcional)</label>
          <input type="text" className="modal__input" placeholder="Ex: Feriado, viagem..." value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        <div className="modal__actions" style={{ marginTop: 8 }}>
          <button className="modal__btn-primary" onClick={handleSave} disabled={!date}>🚫 Confirmar Bloqueio</button>
          <button className="modal__btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

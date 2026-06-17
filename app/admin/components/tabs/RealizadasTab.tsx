import { formatDate } from '../../helpers'
import type { MockConsultation } from '../../types'

/* ─────────────────────────────────────────────
   ABA REALIZADAS
───────────────────────────────────────────── */

export function RealizadasTab({ items }: { items: MockConsultation[] }) {
  if (items.length === 0) {
    return (
      <div className="admin__empty">
        <div className="admin__empty-icon">📚</div>
        <div className="admin__empty-title">Nenhuma consulta realizada ainda</div>
      </div>
    )
  }

  return (
    <>
      <div className="admin__section-header">
        <h1 className="admin__section-title">Consultas Realizadas</h1>
        <p className="admin__section-sub">{items.length} consulta{items.length !== 1 ? 's' : ''} concluída{items.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="admin__cards">
        {items.map(c => (
          <div key={c.id} className="realized__card">
            <div className="realized__info">
              <div className="realized__name">{c.client_name}</div>
              <div className="realized__meta">📧 {c.client_email} · 🎂 {c.birth_date} · ⏱ {formatDate(c.created_at)}</div>
            </div>
            <span className="realized__badge">✅ Concluída</span>
          </div>
        ))}
      </div>
    </>
  )
}

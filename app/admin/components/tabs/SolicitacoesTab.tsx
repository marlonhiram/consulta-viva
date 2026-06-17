import { getSlaInfo, formatDate } from '../../helpers'
import type { MockConsultation } from '../../types'

/* ─────────────────────────────────────────────
   ABA SOLICITAÇÕES
───────────────────────────────────────────── */

export function SolicitacoesTab({ items, onSelect }: { items: MockConsultation[]; onSelect: (c: MockConsultation) => void }) {
  const sorted = [...items].sort((a, b) => getSlaInfo(a.created_at).hoursLeft - getSlaInfo(b.created_at).hoursLeft)

  if (sorted.length === 0) {
    return (
      <div className="admin__empty">
        <div className="admin__empty-icon">🌿</div>
        <div className="admin__empty-title">Nenhuma solicitação pendente</div>
        <div className="admin__empty-text">Quando clientes enviarem fotos, elas aparecerão aqui.</div>
      </div>
    )
  }

  return (
    <>
      <div className="admin__section-header">
        <h1 className="admin__section-title">Solicitações de Consultas</h1>
        <p className="admin__section-sub">{sorted.length} solicitação{sorted.length !== 1 ? 'ões' : ''} aguardando análise · Prazo: 48h</p>
      </div>
      <div className="admin__cards">
        {sorted.map(c => {
          const sla = getSlaInfo(c.created_at)
          return (
            <div key={c.id} className="admin__card" onClick={() => onSelect(c)}>
              <div className="admin__card-body">
                <div className="admin__card-name">{c.client_name}</div>
                <div className="admin__card-meta">
                  <span>📧 {c.client_email}</span>
                  <span>🎂 {c.birth_date}</span>
                  <span>✋ {c.hand_dominance}</span>
                  <span>📸 {c.photos.length} foto{c.photos.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="admin__card-preview">"{c.messages_preview}"</div>
                <div className="admin__card-meta" style={{ marginTop: 4 }}>
                  <span suppressHydrationWarning>⏱ {formatDate(c.created_at)}</span>
                </div>
              </div>
              <div className="admin__card-actions">
                <span className={`admin__badge ${sla.badgeClass}`}>{sla.label}</span>
                <span className="admin__card-cta">Abrir e fazer consulta →</span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

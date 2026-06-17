'use client'
import type { Politica } from '../../types'

/* ─── Modal Política ────────────────────────────────────────────────────── */

export function ModalPolitica({ politica, onClose }: { politica: Politica; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--politica" onClick={e => e.stopPropagation()}>
        <div className="modal-politica-header">
          <span className="modal-politica-icone">{politica.icone}</span>
          <div className="modal-eyebrow">Informações</div>
        </div>
        <h2 className="modal-title">{politica.titulo}</h2>
        <div className="modal-politica-conteudo">
          {politica.conteudo.split('\n\n').map((paragrafo, i) => (
            <p key={i} className="modal-politica-paragrafo">{paragrafo}</p>
          ))}
        </div>
        <button className="modal-cancel" onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}

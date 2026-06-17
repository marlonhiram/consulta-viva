'use client'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { getSlaInfo } from '../helpers'
import type { MockConsultation } from '../types'
import { CancelModal } from './modals/CancelModal'
import { RefuseModal } from './modals/RefuseModal'

/* ─────────────────────────────────────────────
   TELA DE TRABALHO
───────────────────────────────────────────── */

export function WorkView({ consultation, onBack }: { consultation: MockConsultation; onBack: () => void }) {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [reading, setReading] = useState('')
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saved'>('idle')
  const [showSendModal, setShowSendModal] = useState(false)
  const [showRefuseModal, setShowRefuseModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const STORAGE_KEY = `quiros_draft_${consultation.id}`

  useEffect(() => {
    if (!lightboxOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxOpen])

  useEffect(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setReading(saved) } catch {}
  }, [STORAGE_KEY])

  const handleReadingChange = useCallback((value: string) => {
    setReading(value)
    setAutosaveStatus('idle')
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, value); setAutosaveStatus('saved') } catch {}
    }, 1200)
  }, [STORAGE_KEY])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const handleSendConfirm = async () => {
    try {
      const res = await fetch('/admin/enviar-leitura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId: consultation.id, analysisSummary: reading }),
      })
      const data = await res.json()
      setShowSendModal(false)
      if (!res.ok) { showToast('❌ Erro: ' + (data.error ?? 'Não foi possível enviar.')); return }
      try { localStorage.removeItem(STORAGE_KEY) } catch {}
      showToast('✅ Avaliação enviada com sucesso para ' + consultation.client_name + '!')
      setTimeout(() => onBack(), 2500)
    } catch {
      setShowSendModal(false)
      showToast('❌ Erro de conexão.')
    }
  }

  const activePhoto = consultation.photos[activePhotoIdx]

  return (
    <div className="work">
      <header className="work__topbar">
        <button className="work__back" onClick={onBack}>← Voltar</button>
        <div style={{ textAlign: 'center' }}>
          <div className="work__title">Fazendo a Consulta</div>
          <div className="work__client-name">{consultation.client_name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(() => { const sla = getSlaInfo(consultation.created_at); return <span className={`admin__badge ${sla.badgeClass}`}>{sla.label}</span> })()}
        </div>
      </header>

      <div className="work__main">
        <div className="work__photos">
          <div className="work__photos-header">
            <div className="work__photos-title">📸 Foto do Rosto</div>
            <div className="work__photos-sub">{consultation.photos.length} foto{consultation.photos.length !== 1 ? 's' : ''}</div>
          </div>
          <div className={`work__photo-main${lightboxOpen ? ' work__photo-main--expanded' : ''}`}>
  {activePhoto ? (
    lightboxOpen ? (
      <div className="work__photo-expanded">
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={10}
          centerOnInit
          doubleClick={{ mode: 'zoomIn' }}
        >
            {({ resetTransform }) => (
              <>
                <div className="work__expanded-toolbar">
                  <span className="work__expanded-label">
                    {activePhoto.hand_type === 'rosto' ? '🤳 Rosto'
                      : activePhoto.hand_type === 'direita' ? '👋 Mão Direita'
                      : activePhoto.hand_type === 'esquerda' ? '🤚 Mão Esquerda'
                      : '🖐 Perfil'} — Foto {activePhotoIdx + 1} de {consultation.photos.length}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="lightbox__btn" onClick={() => resetTransform()}>↺ Reset</button>
                    <button className="lightbox__btn" onClick={() => setLightboxOpen(false)}>✕ Fechar</button>
                  </div>
                </div>
                <TransformComponent
                  wrapperStyle={{ width: '100%', height: 'calc(100% - 40px)' }}
                  contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <img
                    src={activePhoto.url}
                    alt={activePhoto.hand_type}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none', cursor: 'crosshair' }}
                    draggable={false}
                  />
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </div>
      ) : (
        <div
          className="work__photo-img-wrap"
          style={{ cursor: 'zoom-in' }}
          onClick={() => setLightboxOpen(true)}
          title="Clique para ampliar"
        >
          <img
            src={activePhoto.url}
            alt={activePhoto.hand_type}
            className="work__photo-img"
            draggable={false}
          />
          <div className="work__photo-hint">🔍 Clique para ampliar</div>
        </div>
      )
    ) : (
    <p style={{ color: 'rgba(232,220,200,0.4)', fontSize: 18, textAlign: 'center' }}>Nenhuma foto</p>
  )}
</div>
          {activePhoto && (
            <div className="work__hand-label">
              {activePhoto.hand_type === 'rosto' ? '🤳 Rosto'
                : activePhoto.hand_type === 'direita' ? '👋 Mão Direita'
                : activePhoto.hand_type === 'esquerda' ? '🤚 Mão Esquerda'
                : '🖐 Perfil'} — Foto {activePhotoIdx + 1} de {consultation.photos.length}
            </div>
          )}
         {consultation.photos.length > 1 && (
          <div className="work__thumbnails">
            {(['rosto', 'direita', 'esquerda', 'perfil'] as const).map(hand => {
              const grupo = consultation.photos.filter(p => p.hand_type === hand)
              if (grupo.length === 0) return null
              const grupoLabel = hand === 'rosto' ? '🤳 Rosto'
                : hand === 'direita' ? '👋 Mão Direita'
                : hand === 'esquerda' ? '🤚 Mão Esquerda'
                : '🖐 Perfil'
              return (
                <Fragment key={hand}>
                  <div className="work__thumb-group-label">{grupoLabel}</div>
                  {grupo.map(p => {
                    const i = consultation.photos.findIndex(ph => ph.id === p.id)
                    return (
                      <img
                        key={p.id}
                        src={p.url}
                        alt={p.hand_type}
                        className={`work__thumb${i === activePhotoIdx ? ' work__thumb--active' : ''}`}
                        onClick={() => setActivePhotoIdx(i)}
                        title={`Foto ${i + 1} — ${grupoLabel}`}
                      />
                    )
                  })}
                </Fragment>
              )
            })}
          </div>
        )}

        {/* Botão de download da foto ativa */}
        {activePhoto && (
          <button
            className="work__download-btn"
            onClick={async () => {
              try {
                const res = await fetch(activePhoto.url)
                const blob = await res.blob()
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `${consultation.client_name}-${activePhoto.hand_type}.jpg`
                a.click()
                URL.revokeObjectURL(a.href)
              } catch {
                alert('Erro ao baixar a foto.')
              }
            }}
          >
            ⬇ Download desta foto
          </button>
        )}
        </div>

        <div className="work__pad">
          <div className="work__pad-header">
            <div className="work__pad-title">📝 Prancheta de Avaliação</div>
            <div className="work__pad-info">
              <span className="work__pad-client">Cliente: <strong>{consultation.client_name}</strong> · {consultation.birth_date} · {consultation.hand_dominance}</span>
              <span className={`work__autosave${autosaveStatus === 'saved' ? ' work__autosave--saved' : ''}`}>{autosaveStatus === 'saved' ? '✓ Rascunho salvo' : 'Digitando...'}</span>
            </div>
          </div>
          <textarea className="work__textarea" placeholder="Escreva aqui a avaliação para esta pessoa..." value={reading} onChange={e => handleReadingChange(e.target.value)} />
          <div className="work__pad-footer">
            <button className="work__btn-refuse" onClick={() => setShowRefuseModal(true)}>❌ Recusar Fotos</button>
            <button className="work__btn-cancel" onClick={() => setShowCancelModal(true)}>🚫 Cancelar Consulta</button>
            <button className="work__btn-send" onClick={() => setShowSendModal(true)} disabled={reading.trim().length < 10}>✉️ Enviar Avaliação</button>
          </div>
        </div>
      </div>

      {showSendModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal__icon">✉️</div>
            <h2 className="modal__title">Enviar avaliação para {consultation.client_name}?</h2>
            <p className="modal__text">Esta ação não pode ser desfeita.</p>
            <div className="modal__actions">
              <button className="modal__btn-primary" onClick={handleSendConfirm}>✅ Sim, Enviar</button>
              <button className="modal__btn-secondary" onClick={() => setShowSendModal(false)}>Revisar</button>
            </div>
          </div>
        </div>
      )}

      {showRefuseModal && (
        <RefuseModal
          clientName={consultation.client_name}
          onClose={() => setShowRefuseModal(false)}
          onConfirm={async reason => {
            try {
              const res = await fetch('/admin/recusar-fotos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consultationId: consultation.id, rejectionReason: reason }) })
              const data = await res.json()
              setShowRefuseModal(false)
              if (!res.ok) { showToast('❌ ' + (data.error ?? 'Erro.')); return }
              showToast(`⚠️ Fotos recusadas.`)
              setTimeout(() => onBack(), 2500)
            } catch { setShowRefuseModal(false); showToast('❌ Erro de conexão.') }
          }}
        />
      )}

      {showCancelModal && (
        <CancelModal
          clientName={consultation.client_name}
          onClose={() => setShowCancelModal(false)}
          onConfirm={async reason => {
            try {
              const res = await fetch('/admin/cancelar-consulta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consultationId: consultation.id, cancellationReason: reason }) })
              const data = await res.json()
              setShowCancelModal(false)
              if (!res.ok) { showToast('❌ ' + (data.error ?? 'Erro.')); return }
              showToast('✅ Consulta cancelada.')
              setTimeout(() => onBack(), 2500)
            } catch { setShowCancelModal(false); showToast('❌ Erro de conexão.') }
          }}
        />
      )}

      {toast && <div className="toast"><span>{toast}</span></div>}
    </div>
  )
}

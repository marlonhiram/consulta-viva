'use client'

import { useState, useRef, useEffect, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import './triagem-retornante.css'

interface Props {
  userId: string
  userEmail: string
  userName: string
  handDominance: string
}

interface PhotoPreview {
  file: File
  url: string
  label: string
}

const MAX_SIZE = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

const INSTRUCOES: Record<string, { group?: string; label: string; desc: string }[]> = {
  destro: [
    { label: 'Palma da mão direita', desc: 'Mão aberta, câmera próxima, mostrando as linhas' },
    { label: 'Lateral da mão direita', desc: 'Na altura do dedo mindinho' },
  ],
  canhoto: [
    { group: 'Mão Esquerda (dominante)', label: 'Palma da mão esquerda', desc: 'Mão aberta, câmera próxima, mostrando as linhas' },
    { label: 'Lateral da mão esquerda', desc: 'Na altura do dedo mindinho' },
    { group: 'Mão Direita', label: 'Palma da mão direita', desc: 'Mão aberta, câmera próxima, mostrando as linhas' },
    { label: 'Lateral da mão direita', desc: 'Na altura do dedo mindinho' },
  ],
}

const LABELS: Record<string, string[]> = {
  destro:  ['Palma direita', 'Lateral direita'],
  canhoto: ['Palma esquerda', 'Lateral esquerda', 'Palma direita', 'Lateral direita'],
}

/* ── ModalPix ── */
function ModalPix({ consultationId, userEmail, userName, onPago }: {
  consultationId: string
  userEmail: string
  userName: string
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
      .channel(`payment-retornante-${consultationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payments',
        filter: `consultation_id=eq.${consultationId}`,
      }, (payload) => {
        if (payload.new.status === 'paid') {
          setStep('confirmado')
          setTimeout(() => onPago(), 2000)
        }
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [step, consultationId, supabase, onPago])

  async function copiarPix() {
    try { await navigator.clipboard.writeText(pixCopiaECola); setCopiado(true); setTimeout(() => setCopiado(false), 3000) } catch {}
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box--pix">
        {step === 'loading' && (
          <>
            <p className="pix-eyebrow">Consulta Premium</p>
            <h2 className="pix-titulo">Gerando seu PIX...</h2>
            <p className="pix-desc">Conectando ao Mercado Pago...</p>
          </>
        )}
        {step === 'qr' && (
          <>
            <p className="pix-eyebrow">Consulta Premium · R$ 197,00</p>
            <h2 className="pix-titulo">Pague via PIX</h2>
            <p className="pix-desc">
              Escaneie o QR Code ou copie o código. Após o pagamento, seu agendamento será liberado automaticamente.
            </p>
            {qrCodeBase64 && (
              <div className="pix-qr-wrap">
                <img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR Code PIX" className="pix-qr-img" />
              </div>
            )}
            <button className="pix-copiar-btn" onClick={copiarPix}>
              {copiado ? '✓ Código copiado!' : 'Copiar código PIX'}
            </button>
            <div className="pix-aguardando">
              <span className="pix-dot" />
              Aguardando confirmação do pagamento...
            </div>
            <p className="pix-validade">O PIX expira em 30 minutos · Mercado Pago</p>
          </>
        )}
        {step === 'confirmado' && (
          <>
            <p style={{ textAlign: 'center', fontSize: '32px' }}>✦</p>
            <h2 className="pix-titulo">Pagamento confirmado!</h2>
            <p className="pix-desc">Redirecionando para o agendamento...</p>
          </>
        )}
        {step === 'erro' && (
          <>
            <h2 className="pix-titulo">Erro ao gerar PIX</h2>
            <p className="pix-desc">Tente novamente.</p>
            <button className="pix-copiar-btn" onClick={gerarPix}>Tentar novamente</button>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Componente principal ── */
export default function TriagemRetornanteClient({ userId, userEmail, userName, handDominance }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const dominance = handDominance === 'canhoto' ? 'canhoto' : 'destro'
  const instrucoes = INSTRUCOES[dominance]
  const labels = LABELS[dominance]
  const requiredPhotos = dominance === 'canhoto' ? 4 : 2

  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [drag, setDrag] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [consultationId, setConsultationId] = useState<string | null>(null)

  function processFiles(files: FileList | null) {
    if (!files) return
    setErro(null)
    Array.from(files).forEach(file => {
      if (!ACCEPTED.includes(file.type)) { setErro('Apenas JPG, PNG ou WEBP.'); return }
      if (file.size > MAX_SIZE) { setErro('Cada foto deve ter no máximo 5MB.'); return }
      if (photos.length >= requiredPhotos) { setErro(`Máximo de ${requiredPhotos} fotos.`); return }
      const url = URL.createObjectURL(file)
      const label = labels[photos.length] ?? `Foto ${photos.length + 1}`
      setPhotos(prev => [...prev, { file, url, label }])
    })
  }

  function removePhoto(idx: number) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].url)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const MAX = 1200
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
          else { width = Math.round((width * MAX) / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = url
    })

  async function handleContinuar() {
    if (photos.length < requiredPhotos) {
      setErro(`Envie ${requiredPhotos} fotos para continuar.`)
      return
    }
    setErro(null)
    setLoading(true)

    try {
      const base64Photos = await Promise.all(photos.map(p => fileToBase64(p.file)))

      const res = await fetch('/api/retornante/criar-consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: base64Photos }),
      })

      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao enviar. Tente novamente.'); return }

      setConsultationId(data.consultationId)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {consultationId && (
        <ModalPix
          consultationId={consultationId}
          userEmail={userEmail}
          userName={userName}
          onPago={() => router.push(`/dashboard/agendar/${consultationId}`)}
        />
      )}

      <div className="retornante-root">
        <header className="retornante-header">
          <button className="retornante-back" onClick={() => router.push('/dashboard')}>← Voltar</button>
          <span className="retornante-logo">Quiros</span>
          <div style={{ width: 60 }} />
        </header>

        <main className="retornante-main">
          <p className="retornante-eyebrow">Nova Consulta</p>
          <h1 className="retornante-titulo">Atualize suas fotos</h1>
          <p className="retornante-desc">
            Envie materiais atualizados para que a especialista possa realizar uma nova análise personalizada.
          </p>

          {/* Instruções */}
          <div className="retornante-instrucoes">
            {instrucoes.map((item, i) => (
              <Fragment key={i}>
                {item.group && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold-dk)', margin: '4px 0 0' }}>
                    {item.group}
                  </p>
                )}
                <div className={`retornante-instrucao-card${i < photos.length ? ' done' : ''}`}>
                  <div className="retornante-instrucao-num">
                    {i < photos.length ? '✓' : i + 1}
                  </div>
                  <div className="retornante-instrucao-info">
                    <span className="retornante-instrucao-label">{item.label}</span>
                    <span className="retornante-instrucao-desc">{item.desc}</span>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>

          {/* Previews */}
          {photos.length > 0 && (
            <div className="retornante-previews">
              {photos.map((p, i) => (
                <div key={i} className="retornante-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.label} />
                  <button className="retornante-preview-remove" onClick={() => removePhoto(i)}>×</button>
                  <div className="retornante-preview-label">{p.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Upload zone */}
          {photos.length < requiredPhotos && (
            <div
              className={`retornante-upload-zone${drag ? ' drag' : ''}`}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); processFiles(e.dataTransfer.files) }}
            >
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={e => processFiles(e.target.files)} />
              <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" style={{ display: 'none' }} onChange={e => processFiles(e.target.files)} />

              <span className="retornante-upload-icon">🖐</span>
              <span className="retornante-upload-title">
                {photos.length === 0
                  ? 'Como deseja enviar as fotos?'
                  : `${photos.length}/${requiredPhotos} foto(s) adicionada(s)`}
              </span>
              <div className="retornante-upload-btns">
                <button className="retornante-upload-btn" onClick={e => { e.stopPropagation(); cameraInputRef.current?.click() }}>
                  📷 Tirar foto
                </button>
                <button className="retornante-upload-btn" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
                  🖼️ Escolher da galeria
                </button>
              </div>
              <span className="retornante-upload-limit">JPG / PNG / WEBP · Máximo 5MB cada</span>
            </div>
          )}

          {erro && <p className="retornante-erro">{erro}</p>}

          <button
            className="retornante-btn"
            onClick={handleContinuar}
            disabled={loading || photos.length < requiredPhotos}
          >
            {loading
              ? 'Enviando fotos...'
              : photos.length < requiredPhotos
                ? `Aguardando ${requiredPhotos - photos.length} foto(s)`
                : 'Continuar para pagamento →'}
          </button>
        </main>

        <footer style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(19,15,10,0.25)', borderTop: '1px solid var(--border)' }}>
          Quiros · Quirologia Analítica
        </footer>
      </div>
    </>
  )
}
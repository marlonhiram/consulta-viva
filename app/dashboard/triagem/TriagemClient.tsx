'use client'

import { useState, useRef, useEffect, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import './triagem.css'

interface Message {
  id: string
  role: 'ai' | 'user' | 'system'
  text: string
  time: string
}

interface PhotoPreview {
  file: File
  url: string
  label: string
}

const STEPS = ['Dados Pessoais', 'Seu Contexto', 'Foto', 'Conclusão']
const MAX_SIZE = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

function now() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function genId() {
  return Math.random().toString(36).slice(2)
}

interface TriagemProps {
  consultationId: string
  userId: string
  firstName: string
}

export default function TriagemClient({ consultationId, userId, firstName }: TriagemProps) {
  const router = useRouter()
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [showUploader, setShowUploader] = useState(false)
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [drag, setDrag] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const initializedRef = useRef(false)

  const requiredPhotos = 1

  const photoLabels: Record<number, string[]> = {
    1: ['Foto frontal do rosto'],
  }

  const photoInstructions: Record<number, { group?: string; label: string; desc: string }[]> = {
    1: [
      { label: 'Foto frontal do rosto', desc: 'Ambiente bem iluminado, fundo neutro, rosto centralizado e completamente visível' },
    ],
  }

  const geminiHistory = useRef<{ role: string; parts: [{ text: string }] }[]>([])
  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const zoomImgRef = useRef<HTMLImageElement>(null)
  const photosEnviadasRef = useRef(false)


  // Scroll automático
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  // ── Foco automático após resposta da IA ──
  useEffect(() => {
    if (!loading && !showUploader && !done) {
      inputRef.current?.focus()
    }
  }, [loading, showUploader, done])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    setTimeout(() => callGemini('Olá', false), 100)
  }, [])

  const addMessage = useCallback((role: Message['role'], text: string) => {
    setMessages(prev => [...prev, { id: genId(), role, text, time: now() }])
  }, [])

  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
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
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, width, height)
          URL.revokeObjectURL(url)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }
        img.onerror = reject
        img.src = url
      })
    }

  async function callGemini(userText: string, photosConfirmed = false) {
    setLoading(true)

    if (userText) {
      geminiHistory.current.push({ role: 'user', parts: [{ text: userText }] })
    }


let base64Photos: string[] = [];

if (photosConfirmed && photos.length > 0) {
  try {
    base64Photos = await Promise.all(
      photos.map(p => fileToBase64(p.file))
    )
  } catch (err) {
    console.error('Erro ao converter fotos:', err)
    addMessage('system', 'Houve um erro ao processar as fotos. Tente novamente.')
    photosEnviadasRef.current = false
    setShowUploader(true)
    setLoading(false)
    return
  }
}
// --------------------------------------------

    try {
      const res = await fetch('/api/ai-triagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: geminiHistory.current,
          photosConfirmed,
          consultationId,
          userId,
          photos: base64Photos,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro na API')

      const aiText: string = data.text
      geminiHistory.current.push({ role: 'model', parts: [{ text: aiText }] })

      // Remove markdown do texto exibido
      const aiTextLimpo = aiText
        .replace(/\*\*(.*?)\*\*/g, '$1')  // **negrito** → texto
        .replace(/\*(.*?)\*/g, '$1')       // *itálico* → texto
        .replace(/^[\*\-] /gm, '• ')       // * item → • item

      addMessage('ai', aiTextLimpo)

      if (data.photoQualityWarning) {
        addMessage('system', `⚠️ ${data.photoQualityWarning}`)
      }

      if (data.showUploader && !photosEnviadasRef.current) { setShowUploader(true); setStep(2) }
      if (data.isComplete) { setStep(3); setDone(true) }
      else if (!data.showUploader && step === 0 && geminiHistory.current.length > 2) {
        setStep(1)
      }
    } catch (err) {
      console.error('Erro callGemini:', err)
      addMessage('system', 'Houve um erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    addMessage('user', text)
    await callGemini(text)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function processFiles(files: FileList | null) {
    if (!files) return
    setUploadError(null)
    const labels = photoLabels[requiredPhotos] ?? photoLabels[2]
    const newFiles = Array.from(files).filter(file => {
      if (!ACCEPTED.includes(file.type)) { setUploadError('Formato inválido. Use JPG, PNG ou WEBP.'); return false }
      if (file.size > MAX_SIZE) { setUploadError('Arquivo muito grande. Máximo 5MB.'); return false }
      return true
    })

    setPhotos(prev => {
      const result = [...prev]
      for (const file of newFiles) {
        if (result.length >= requiredPhotos) break
        const url = URL.createObjectURL(file)
        const label = labels[result.length] ?? `Foto ${result.length + 1}`
        result.push({ file, url, label })
      }
      return result
    })
  }

  function removePhoto(idx: number) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].url)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function confirmPhotos() {
    if (confirming || photosEnviadasRef.current) return
    if (photos.length < requiredPhotos) {
      setUploadError(`Envie ${requiredPhotos} foto(s) para continuar.`)
      return
    }

    setConfirming(true)
    setShowUploader(false)
    photosEnviadasRef.current = true

    const userMsg = 'Enviei a foto do rosto solicitada.'
    addMessage('user', userMsg)

    try {
      await callGemini(userMsg, true)
      setPhotos([])
    } catch {
      photosEnviadasRef.current = false
      setShowUploader(true)
      setUploadError('Erro ao enviar as fotos. Tente novamente.')
    } finally {
      setConfirming(false)
    }
  }

  async function finishTriagem() {
    await new Promise(r => setTimeout(r, 1500))
    window.location.href = '/dashboard'
  }

  return (
    <div className="triagem-layout">

      {/* Header */}
      <header className="triagem-header">
        <a href="/" className="header-logo">ConsultaViva</a>
        <span className="header-step">Triagem Assistida · Etapa {step + 1} de {STEPS.length}</span>
      </header>

      {/* Progress */}
      <div className="progress-bar">
        <div className="progress-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`progress-step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
              <div className="step-dot">
                {i < step ? '✓' : i + 1}
              </div>
              <span className="step-label">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="chat-area" ref={chatRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`msg ${msg.role === 'user' ? 'user' : 'ai'}`}>
            {msg.role !== 'user' && (
              <div className="msg-avatar">Q</div>
            )}
            <div>
              <div className="msg-bubble">{msg.text}</div>
              <div className="msg-time" style={{ textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                {msg.time}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="msg ai">
            <div className="msg-avatar">Q</div>
            <div className="typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      {/* Previews de fotos */}
      {photos.length > 0 && (
        <div className="photo-previews">
          {photos.map((p, i) => (
            <div key={i} className="preview-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.label} />
              <button className="preview-remove" onClick={() => removePhoto(i)}>×</button>
              <div className="preview-label">{p.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {/* Cards de instrução de fotos */}
      {showUploader && !loading && (
        <div className="photo-instructions">
          {(photoInstructions[requiredPhotos] ?? photoInstructions[1]).map((item, i) => (
            <Fragment key={i}>
              {item.group && (
                <div className="photo-instruction-group">{item.group}</div>
              )}
              <div className={`photo-instruction-card${i < photos.length ? ' pic--done' : ''}`}>
                <div className="pic-number">{i < photos.length ? '✓' : i + 1}</div>
                <div className="pic-info">
                  <span className="pic-label">{item.label}</span>
                  <span className="pic-desc">{item.desc}</span>
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {showUploader && !loading && (
        <div
          className={`upload-zone ${drag ? 'drag' : ''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); processFiles(e.dataTransfer.files) }}
        >
{/* Input galeria */}
<input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,image/webp"
  style={{ display: 'none' }}
  onChange={e => processFiles(e.target.files)}
/>
{/* Input câmera */}
<input
  ref={cameraInputRef}
  type="file"
  accept="image/jpeg,image/png,image/webp"
  capture="environment"
  style={{ display: 'none' }}
  onChange={e => processFiles(e.target.files)}
/>
<span className="upload-icon">🤳</span>
<span className="upload-title">
  {photos.length === 0
    ? 'Como deseja enviar a foto?'
    : `Foto adicionada`}
</span>
<div className="upload-btns">
  <button
    className="upload-btn-opt"
    onClick={e => { e.stopPropagation(); cameraInputRef.current?.click() }}
  >
    📷 Tirar foto
  </button>
  <button
    className="upload-btn-opt"
    onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
  >
    🖼️ Escolher da galeria
  </button>
</div>
<span className="upload-limit">JPG / PNG / WEBP · Máximo 5MB cada</span>
{uploadError && <span style={{ color: '#e07060', fontSize: '12px' }}>{uploadError}</span>}
        </div>
      )}

      {/* Botão confirmar fotos */}
      {showUploader && photos.length > 0 && !loading && (
        <div className="quick-replies">
          <button
            className="qr-btn"
            style={{
              cursor: photos.length >= requiredPhotos && !confirming ? 'pointer' : 'not-allowed',
              opacity: photos.length >= requiredPhotos && !confirming ? 1 : 0.4
            }}
            onClick={confirmPhotos}
            disabled={photos.length < requiredPhotos || confirming}
          >
            {confirming
              ? 'Enviando fotos...'
              : photos.length >= requiredPhotos
                ? `Confirmar ${photos.length} foto(s) →`
                : `Aguardando ${requiredPhotos - photos.length} foto(s) restante(s)`}
          </button>
        </div>
      )}

      {/* Botão finalizar triagem */}
      {done && (
        <div className="quick-replies">
          <button className="qr-btn" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }} onClick={finishTriagem}>
            Ir para minha área →
          </button>
        </div>
      )}

      {/* Input */}
      <div className="input-bar">
        <div className="input-wrap">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={done ? 'Triagem concluída' : 'Digite sua resposta...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            disabled={loading || done || showUploader}
          />
        </div>
        <button className="send-btn" onClick={handleSend} disabled={loading || !input.trim() || done || showUploader}>
          {loading
            ? <div className="spinner" />
            : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 9h14M9 2l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )
          }
        </button>
      </div>
    </div>
  )
}
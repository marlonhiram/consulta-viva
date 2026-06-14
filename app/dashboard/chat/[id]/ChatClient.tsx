'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Message = {
  id: string
  sender_id: string
  content: string
  is_ai: boolean
  message_type: string
  created_at: string
}

type Photo = {
  id: string
  storage_url: string
  hand_type: string
}

type Props = {
  consultationId: string
  scheduledAt: string
  isAdmin: boolean
  userId: string
  clientName: string
  clientBirthDate: string | null
  clientHandDominance: string | null
  analysisSummary: string | null
  initialMessages: Message[]
  photos: Photo[]
}

function useCountdown(scheduledAt: string) {
  const fim = new Date(scheduledAt).getTime() + 30 * 60 * 1000
  const [mounted, setMounted] = useState(false)
  const [estado, setEstado] = useState({ minutos: 30, segundos: 0, encerrado: false })

  useEffect(() => {
    const calcular = () => {
      const restante = Math.max(0, fim - Date.now())
      return {
        minutos: Math.floor(restante / 60000),
        segundos: Math.floor((restante % 60000) / 1000),
        encerrado: restante === 0,
      }
    }
    setEstado(calcular())
    setMounted(true)
    const interval = setInterval(() => setEstado(calcular()), 1000)
    return () => clearInterval(interval)
  }, [fim])

  return { ...estado, mounted }
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  })
}



export default function ChatClient({
  consultationId,
  scheduledAt,
  isAdmin,
  userId,
  clientName,
  clientBirthDate,
  clientHandDominance,
  analysisSummary,
  initialMessages,
  photos,
}: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { minutos, segundos, encerrado, mounted } = useCountdown(scheduledAt)

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [encerradoLocal, setEncerradoLocal] = useState(false)
  const [mostrarFotos, setMostrarFotos] = useState(false)
  const [mostrarTriagem, setMostrarTriagem] = useState(false)
  const [mostrarEncerrarModal, setMostrarEncerrarModal] = useState(false)
  const [fotoZoom, setFotoZoom] = useState<{ url: string; label: string } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [transformOrigin, setTransformOrigin] = useState('center center')
  const [panAtivo, setPanAtivo] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [fotosVistas, setFotosVistas] = useState<Set<string>>(new Set())
  const [sidebarZoom, setSidebarZoom] = useState<{ url: string; label: string } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const zoomImgRef = useRef<HTMLImageElement>(null)
  // Separar mensagens de triagem das mensagens de chat
  const mensagensTriagem = messages.filter(m => m.message_type === 'system' || m.message_type === 'action')
  const mensagensChat = messages.filter(m => m.message_type === 'text' || m.message_type === 'image')
  const fotosChat = messages.filter(m => m.message_type === 'image')
  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagensChat])

  // Supabase Realtime — escutar novas mensagens
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${consultationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `consultation_id=eq.${consultationId}`,
      }, (payload) => {
        const nova = payload.new as Message
        setMessages(prev => {
          if (prev.find(m => m.id === nova.id)) return prev
          return [...prev, nova]
        })
      })
      .subscribe((status) => {
      })

  return () => { supabase.removeChannel(channel) }
}, [consultationId])

  // Encerrar automaticamente quando cronômetro zerar
  useEffect(() => {
    if (encerrado && !encerradoLocal) {
      setEncerradoLocal(true)
    }
  }, [encerrado, encerradoLocal])

  const handleEnviar = useCallback(async () => {
    if (!input.trim() || enviando || encerradoLocal) return
    const texto = input.trim()
    setInput('')
    setEnviando(true)

    try {
      await fetch('/api/chat/enviar-mensagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId, content: texto }),
      })
    } catch {
      setInput(texto) // restaurar se falhou
    } finally {
      setEnviando(false)
      inputRef.current?.focus()
    }
  }, [input, enviando, encerradoLocal, consultationId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  const handleEncerrar = async () => {
    setEncerrando(true)
    try {
      await fetch('/api/chat/encerrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId }),
      })
      setEncerradoLocal(true)
      setMostrarEncerrarModal(false)
    } catch {
      // silencioso
    } finally {
      setEncerrando(false)
    }
  }

  async function handleEnviarFoto(file: File) {
  if (!file || enviando || encerradoLocal) return
  setEnviando(true)
  try {
    // 1. Redimensiona e converte para blob
    const bitmap = await createImageBitmap(file)
    const MAX = 1200
    let { width, height } = bitmap
    if (width > MAX || height > MAX) {
      if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
      else { width = Math.round((width * MAX) / height); height = MAX }
    }
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.82))

    // 2. Upload para Storage
    const path = `${userId}/${consultationId}/chat-${Date.now()}.jpg`
    const { data: storageData, error: storageError } = await supabase.storage
      .from('consultation-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (storageError) throw storageError

    const { data: urlData } = supabase.storage.from('consultation-photos').getPublicUrl(storageData.path)
    const publicUrl = urlData.publicUrl

    // 3. Insere na tabela photos com status 'chat'
    await supabase.from('photos').insert({
      consultation_id: consultationId,
      storage_url: publicUrl,
      hand_type: 'direita',
      status: 'chat',
    })

    // 4. Envia como mensagem no chat
    await fetch('/api/chat/enviar-mensagem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consultationId, content: publicUrl, messageType: 'image' }),
    })
  } catch (err) {
    console.error('Erro ao enviar foto:', err)
  } finally {
    setEnviando(false)
    if (fotoInputRef.current) fotoInputRef.current.value = ''
  }
}

  function abrirZoom(url: string, label: string) {
    if (isAdmin) {
      setSidebarZoom({ url, label })
    } else {
      setFotoZoom({ url, label })
      setZoom(1)
      setTransformOrigin('center center')
      setTranslate({ x: 0, y: 0 })
    }
  }

function fecharZoom() {
  setFotoZoom(null)
  setZoom(1)
  setTranslate({ x: 0, y: 0 })
}

function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
  e.preventDefault()
  const rect = e.currentTarget.getBoundingClientRect()
  const ox = e.clientX - rect.left
  const oy = e.clientY - rect.top
  const novoZoom = Math.min(Math.max(zoom + (e.deltaY < 0 ? 0.3 : -0.3), 1), 5)
  setTransformOrigin(`${ox}px ${oy}px`)
  setZoom(novoZoom)
  if (novoZoom === 1) setTranslate({ x: 0, y: 0 })
}

function handleMouseDown(e: React.MouseEvent) {
  if (zoom <= 1) return
  setPanAtivo(true)
  setPanStart({ x: e.clientX - translate.x, y: e.clientY - translate.y })
}

function handleMouseMove(e: React.MouseEvent) {
  if (!panAtivo) return
  setTranslate({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
}

function handleMouseUp() { setPanAtivo(false) }

async function downloadFoto(url: string, label: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${label}.jpg`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch { alert('Erro ao baixar foto.') }
}

  const urgente = mounted && minutos < 5 && !encerradoLocal
  const cronometroClass = encerradoLocal
    ? 'chat-cronometro chat-cronometro--encerrado'
    : urgente
      ? 'chat-cronometro chat-cronometro--urgente'
      : 'chat-cronometro'

  return (
    <div className={`chat-root${isAdmin ? ' chat-root--admin' : ''}`}>

      {/* ── Header ── */}
      <header className="chat-header">
        <div className="chat-header-left">
          <button className="chat-back" onClick={() => router.push(isAdmin ? '/admin' : '/dashboard')}>
            ←
          </button>
          <div className="chat-header-info">
            <span className="chat-header-title">
              {isAdmin ? `Consulta — ${clientName}` : 'Consulta Premium'}
            </span>
            <span className="chat-header-sub">
              {isAdmin
                ? `${clientBirthDate ?? ''} · ${clientHandDominance ?? ''}`
                : 'Sessão ao vivo com a especialista'}
            </span>
          </div>
        </div>

        <div className="chat-header-right">
          {/* Cronômetro */}
        <div className="chat-cronometro" suppressHydrationWarning>
          {encerradoLocal ? (
            <span suppressHydrationWarning>Encerrada</span>
          ) : (
            <span suppressHydrationWarning>
              {mounted ? `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}` : '30:00'}
            </span>
          )}
        </div>

          {/* Botões de contexto */}
          {photos.length > 0 && (
            <button className="chat-btn-context" onClick={() => setMostrarFotos(true)} title="Ver fotos">
              📸
            </button>
          )}
          {(analysisSummary || mensagensTriagem.length > 0) && (
            <button className="chat-btn-context" onClick={() => setMostrarTriagem(true)} title="Ver triagem">
              📋
            </button>
          )}
          {isAdmin && !encerradoLocal && (
            <button className="chat-btn-encerrar" onClick={() => setMostrarEncerrarModal(true)}>
              Encerrar
            </button>
          )}
        </div>
      </header>

      {/* ── Layout principal ── */}
      <div className="chat-layout">

        {/* ── Sidebar admin (desktop) ── */}
        {isAdmin && (
          <aside className="chat-sidebar">
            {sidebarZoom ? (
              /* ── Foto expandida inline ── */
              <div className="chat-sidebar-expanded">
                <div className="chat-sidebar-expanded-toolbar">
                  <span className="chat-sidebar-expanded-label">{sidebarZoom.label}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="chat-sidebar-expanded-btn" onClick={() => downloadFoto(sidebarZoom.url, sidebarZoom.label)}>⬇</button>
                    <button className="chat-sidebar-expanded-btn" onClick={() => setSidebarZoom(null)}>✕</button>
                  </div>
                </div>
                <TransformWrapper
                  initialScale={1}
                  minScale={0.5}
                  maxScale={10}
                  centerOnInit
                  doubleClick={{ mode: 'zoomIn' }}
                >
                  {({ resetTransform }) => (
                    <>
                      <div style={{ padding: '6px 10px', flexShrink: 0 }}>
                        <button className="chat-sidebar-expanded-btn" onClick={() => resetTransform()}>↺ Reset</button>
                      </div>
                      <TransformComponent
                        wrapperStyle={{ width: '100%', flex: '1', minHeight: 0 }}
                        contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <img
                          src={sidebarZoom.url}
                          alt={sidebarZoom.label}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none', cursor: 'crosshair' }}
                          draggable={false}
                        />
                      </TransformComponent>
                    </>
                  )}
                </TransformWrapper>
              </div>
            ) : (
              /* ── Sidebar normal ── */
              <>
                <div className="chat-sidebar-section">
                  <p className="chat-sidebar-label">Cliente</p>
                  <p className="chat-sidebar-value">{clientName}</p>
                </div>
                {clientBirthDate && (
                  <div className="chat-sidebar-section">
                    <p className="chat-sidebar-label">Nascimento</p>
                    <p className="chat-sidebar-value">{clientBirthDate}</p>
                  </div>
                )}
                {clientHandDominance && (
                  <div className="chat-sidebar-section">
                    <p className="chat-sidebar-label">Dominância</p>
                    <p className="chat-sidebar-value">{clientHandDominance}</p>
                  </div>
                )}
                {(photos.length > 0 || fotosChat.length > 0) && (
                  <div className="chat-sidebar-section">
                    <p className="chat-sidebar-label">Fotos das mãos</p>
                    <div className="chat-sidebar-fotos">
                      {photos.map(foto => (
                        <div key={foto.id} className="chat-sidebar-foto-wrap">
                          <img
                            src={foto.storage_url}
                            alt={foto.hand_type}
                            className="chat-sidebar-foto"
                            onClick={() => abrirZoom(foto.storage_url, foto.hand_type)}
                          />
                          <span className="chat-sidebar-foto-label">{foto.hand_type}</span>
                          <button className="chat-foto-download" onClick={() => downloadFoto(foto.storage_url, foto.hand_type)}>⬇</button>
                        </div>
                      ))}
                      {fotosChat.map(msg => (
                        <div key={msg.id} className="chat-sidebar-foto-wrap" onClick={() => {
                          setFotosVistas(prev => new Set([...prev, msg.id]))
                          abrirZoom(msg.content, 'Foto do chat')
                        }}>
                          <img src={msg.content} alt="Foto do chat" className="chat-sidebar-foto" />
                          <span className="chat-sidebar-foto-label">Chat</span>
                          {!fotosVistas.has(msg.id) && <span className="chat-foto-badge">Novo</span>}
                          <button className="chat-foto-download" onClick={e => { e.stopPropagation(); downloadFoto(msg.content, 'foto-chat') }}>⬇</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {analysisSummary && (
                  <div className="chat-sidebar-section">
                    <p className="chat-sidebar-label">Leitura gratuita</p>
                    <div className="chat-sidebar-analise">
                      {analysisSummary.split('\n').filter(Boolean).slice(0, 6).map((linha, i) => (
                        <p key={i} className="chat-sidebar-analise-linha">{linha}</p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        )}

        {/* ── Área de mensagens ── */}
        <div className="chat-main">

          {/* Card de início */}
          <div className="chat-inicio-card">
            <span className="chat-inicio-ornament">◈</span>
            <p className="chat-inicio-titulo">Consulta Premium ao vivo</p>
            <p className="chat-inicio-sub">
              {new Date(scheduledAt).toLocaleDateString('pt-BR', {
                weekday: 'long', day: '2-digit', month: 'long',
                timeZone: 'America/Sao_Paulo',
              })} às {formatHora(scheduledAt)}
            </p>
            <p className="chat-inicio-duracao">Duração: 30 minutos</p>
          </div>

          {/* Card de triagem colapsável (cliente) */}
          {!isAdmin && mensagensTriagem.length > 0 && (
            <div className="chat-triagem-card">
              <button
                className="chat-triagem-toggle"
                onClick={() => setMostrarTriagem(v => !v)}
              >
                <span>📋 Ver resumo da sua leitura gratuita</span>
                <span>{mostrarTriagem ? '▲' : '▼'}</span>
              </button>
              {mostrarTriagem && (
                <div className="chat-triagem-conteudo">
                  {analysisSummary && (
                    <p className="chat-triagem-texto">{analysisSummary}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mensagens do chat */}
          <div className="chat-mensagens">
            {mensagensChat.length === 0 && (
              <p className="chat-sem-mensagens">
                {encerradoLocal
                  ? 'A consulta foi encerrada.'
                  : 'A consulta começou. Envie sua primeira mensagem.'}
              </p>
            )}
            {mensagensChat.map(msg => {
              const minha = msg.sender_id === userId
              return (
                <div key={msg.id} className={`chat-msg ${minha ? 'chat-msg--minha' : 'chat-msg--dela'}`}>
                  {!minha && (
                    <span className="chat-msg-avatar">
                      {isAdmin ? '👤' : '✦'}
                    </span>
                  )}
                  <div className="chat-msg-bubble">
                    {msg.message_type === 'image' ? (
                      <img
                        src={msg.content}
                        alt="Foto enviada"
                        className="chat-msg-imagem"
                        onClick={() => abrirZoom(msg.content, 'Foto do chat')}
                      />
                    ) : (
                      <p className="chat-msg-texto">{msg.content}</p>
                    )}
                    <span className="chat-msg-hora">{formatHora(msg.created_at)}</span>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Tela de encerramento */}
          {encerradoLocal && (
            <div className="chat-encerrado">
              <span className="chat-encerrado-ornament">✦</span>
              <p className="chat-encerrado-titulo">Consulta encerrada</p>
              <p className="chat-encerrado-sub">Obrigada pela sessão.</p>
              <button
                className="chat-encerrado-btn"
                onClick={() => router.push(isAdmin ? '/admin' : '/dashboard')}
              >
                Voltar ao {isAdmin ? 'painel' : 'dashboard'}
              </button>
            </div>
          )}

          {/* Input */}
          {!encerradoLocal && (
            <div className="chat-input-wrap">
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleEnviarFoto(f) }}
              />
              {!isAdmin && (
                <button
                  className="chat-foto-btn"
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={enviando || encerradoLocal}
                  title="Enviar foto"
                >
                  📷
                </button>
              )}
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder="Digite sua mensagem..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={enviando}
              />
              <button
                className="chat-send-btn"
                onClick={handleEnviar}
                disabled={!input.trim() || enviando}
              >
                {enviando ? '...' : '→'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Fotos ── */}
      {mostrarFotos && (
        <div className="chat-modal-overlay" onClick={() => setMostrarFotos(false)}>
          <div className="chat-modal" onClick={e => e.stopPropagation()}>
            <div className="chat-modal-header">
              <span>📸 Fotos das mãos</span>
              <button onClick={() => setMostrarFotos(false)}>×</button>
            </div>
              <div className="chat-modal-fotos">
                {photos.map(foto => (
                  <div key={foto.id} className="chat-modal-foto-wrap">
                    <img
                      src={foto.storage_url}
                      alt={foto.hand_type}
                      className="chat-modal-foto"
                      onClick={() => { setMostrarFotos(false); abrirZoom(foto.storage_url, foto.hand_type) }}
                    />
                    <span className="chat-modal-foto-label">{foto.hand_type}</span>
                    <button className="chat-foto-download" onClick={() => downloadFoto(foto.storage_url, foto.hand_type)}>⬇ Download</button>
                  </div>
                ))}
                {fotosChat.map(msg => (
                  <div key={msg.id} className="chat-modal-foto-wrap">
                    <img
                      src={msg.content}
                      alt="Foto do chat"
                      className="chat-modal-foto"
                      onClick={() => { setMostrarFotos(false); abrirZoom(msg.content, 'Foto do chat') }}
                    />
                    <span className="chat-modal-foto-label">Chat {!fotosVistas.has(msg.id) && <span className="chat-foto-badge">Novo</span>}</span>
                    <button className="chat-foto-download" onClick={() => downloadFoto(msg.content, 'foto-chat')}>⬇ Download</button>
                  </div>
                ))}
              </div>
          </div>
        </div>
      )}

      {/* ── Modal Triagem (admin mobile) ── */}
      {mostrarTriagem && isAdmin && (
        <div className="chat-modal-overlay" onClick={() => setMostrarTriagem(false)}>
          <div className="chat-modal" onClick={e => e.stopPropagation()}>
            <div className="chat-modal-header">
              <span>📋 Leitura gratuita</span>
              <button onClick={() => setMostrarTriagem(false)}>×</button>
            </div>
            <div className="chat-modal-triagem">
              {analysisSummary && <p>{analysisSummary}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Encerrar (admin) ── */}
      {mostrarEncerrarModal && (
        <div className="chat-modal-overlay" onClick={() => setMostrarEncerrarModal(false)}>
          <div className="chat-modal chat-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="chat-modal-header">
              <span>Encerrar consulta</span>
              <button onClick={() => setMostrarEncerrarModal(false)}>×</button>
            </div>
            <p className="chat-modal-texto">
              Tem certeza que deseja encerrar a consulta de <strong>{clientName}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="chat-modal-actions">
              <button className="chat-modal-btn-confirm" onClick={handleEncerrar} disabled={encerrando}>
                {encerrando ? 'Encerrando...' : 'Sim, encerrar'}
              </button>
              <button className="chat-modal-btn-cancel" onClick={() => setMostrarEncerrarModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal Zoom ── */}
      {fotoZoom && (
        <div className="chat-zoom-overlay" onClick={fecharZoom}>
          <div className="chat-zoom-toolbar" onClick={e => e.stopPropagation()}>
            <span className="chat-zoom-label">{fotoZoom.label}</span>
            <div className="chat-zoom-actions">
              <button onClick={() => { setZoom(1); setTranslate({ x: 0, y: 0 }) }}>↺ Reset</button>
              <button onClick={() => downloadFoto(fotoZoom.url, fotoZoom.label)}>⬇ Download</button>
              <button onClick={fecharZoom}>× Fechar</button>
            </div>
          </div>
          <div
            className="chat-zoom-area"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={e => e.stopPropagation()}
            style={{ cursor: zoom > 1 ? (panAtivo ? 'grabbing' : 'grab') : 'zoom-in' }}
          >
            <img
              ref={zoomImgRef}
              src={fotoZoom.url}
              alt={fotoZoom.label}
              className="chat-zoom-img"
              style={{
                transform: `scale(${zoom}) translate(${translate.x / zoom}px, ${translate.y / zoom}px)`,
                transformOrigin,
              }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}

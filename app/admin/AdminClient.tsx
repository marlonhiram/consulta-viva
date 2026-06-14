'use client'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { createClient } from '@/lib/supabase'
import './admin.css'

/* ─────────────────────────────────────────────
   TIPOS
───────────────────────────────────────────── */

type ConsultationStatus =
  | 'triagem' | 'aguardando_analise' | 'fotos_recusadas'
  | 'agendada' | 'em_andamento' | 'concluida' | 'cancelada'

type Tab = 'solicitacoes' | 'realizadas' | 'agenda' | 'reembolsos'

interface MockPhoto {
  id: string
  url: string
  hand_type: string
}

interface MockConsultation {
  id: string
  client_name: string
  client_email: string
  created_at: string
  status: ConsultationStatus
  tipo: string | null
  photos: MockPhoto[]
  messages_preview: string
  birth_date: string
  hand_dominance: string
}

interface AgendaBlock {
  id: string
  starts_at: string
  ends_at: string
  reason: string
  type: 'manual' | 'presencial' | 'bloqueado'
}

interface AgendaConsultation {
  id: string
  scheduled_at: string
  status: ConsultationStatus
  client_name: string
  client_email: string
}

interface ReembolsoItem {
  id: string
  user_id: string
  amount: number
  status: string
  created_at: string
  refund_requested_at: string | null
  client_name: string
  client_email: string
}

/* ─────────────────────────────────────────────
   DADOS MOCK (Solicitações e Realizadas)
───────────────────────────────────────────── */

const now = new Date()
function hoursAgo(h: number): string {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString()
}


/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

function getSlaInfo(createdAt: string) {
  const deadline = new Date(new Date(createdAt).getTime() + 48 * 60 * 60 * 1000)
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursLeft <= 0) return { label: '⚠️ Prazo vencido', badgeClass: 'admin__badge--red', hoursLeft }
  if (hoursLeft <= 24) return { label: `🟡 ${Math.ceil(hoursLeft)}h restantes`, badgeClass: 'admin__badge--yellow', hoursLeft }
  return { label: `🟢 ${Math.ceil(hoursLeft)}h restantes`, badgeClass: 'admin__badge--green', hoursLeft }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

function chatDisponivel(scheduled_at: string): boolean {
  const agora = Date.now()
  const horario = new Date(scheduled_at).getTime()
  return agora >= horario - 5 * 60 * 1000 && agora <= horario + 35 * 60 * 1000
}

const WORK_START = 9
const WORK_END = 18
const SLOT_DURATION = 35

function generateTimeSlots(): string[] {
  const slots: string[] = []
  let current = WORK_START * 60
  while (current + 30 <= WORK_END * 60) {
    const h = Math.floor(current / 60)
    const m = current % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    current += SLOT_DURATION
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

function getWeekDays(baseDate: Date): Date[] {
  const monday = new Date(baseDate)
  const dayOfWeek = monday.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  monday.setDate(monday.getDate() + diff)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/* ─────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────── */

export default function AdminClient() {
  const [activeTab, setActiveTab] = useState<Tab>('solicitacoes')
  const [workConsultation, setWorkConsultation] = useState<MockConsultation | null>(null)
  const [solicitacoes, setSolicitacoes] = useState<MockConsultation[]>([])
  const [realizadas, setRealizadas] = useState<MockConsultation[]>([])
  const [loadingTabs, setLoadingTabs] = useState(true)
  const [agendamentosHoje, setAgendamentosHoje] = useState(0)

    useEffect(() => {
          async function carregar() {
            setLoadingTabs(true)

            try {
              const res = await fetch('/admin/consultas')
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
              const { solics, reals } = await res.json()

              function mapConsultation(c: any): MockConsultation {
                const firstUserMsg = c.messages?.find((m: any) => !m.is_ai)?.content ?? ''
                return {
                  id: c.id,
                  status: c.status,
                  tipo: c.tipo ?? null,
                  created_at: c.created_at,
                  client_name: c.profiles?.full_name ?? 'Cliente',
                  client_email: c.profiles?.email ?? '',
                  birth_date: c.profiles?.birth_date
                    ? new Date(c.profiles.birth_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                    : '—',
                  hand_dominance: c.profiles?.hand_dominance === 'right' ? 'Destro'
                    : c.profiles?.hand_dominance === 'left' ? 'Canhoto' : '—',
                  photos: (c.photos ?? []).map((p: any) => ({
                    id: p.id,
                    url: p.storage_url,
                    hand_type: p.hand_type,
                  })),
                  messages_preview: firstUserMsg.slice(0, 120),
                }
              }

              setSolicitacoes(solics.map(mapConsultation))
              setRealizadas(reals.map(mapConsultation))

              // Agendamentos de hoje
              const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
              const resAgenda = await fetch('/admin/consultas')
              // reutiliza os dados já carregados — conta direto de solics + reals
              const todasConsultas = [...solics, ...reals]
              const hojeCount = todasConsultas.filter(c => {
                if (!c.scheduled_at) return false
                return new Date(c.scheduled_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) === hoje
              }).length
              setAgendamentosHoje(hojeCount)
            } catch (err) {
              console.error('[AdminClient] Erro ao carregar consultas:', err)
            } finally {
              setLoadingTabs(false)
            }
          }
          carregar()
        }, [])

  if (workConsultation) {
    return <WorkView consultation={workConsultation} onBack={() => setWorkConsultation(null)} />
  }

  return (
    <div className="admin">
      <header className="admin__topbar">
        <div className="admin__logo">ConsultaViva <span>Painel da Especialista</span></div>
        <div className="admin__user"><span>👤 Bem-vinda</span></div>
      </header>

      <nav className="admin__tabs">
        <button className={`admin__tab${activeTab === 'solicitacoes' ? ' admin__tab--active' : ''}`} onClick={() => setActiveTab('solicitacoes')}>
          📋 Solicitações
          {solicitacoes.length > 0 && (
            <span style={{ marginLeft: 8, background: 'var(--gold)', color: 'var(--dark)', borderRadius: 12, padding: '2px 9px', fontSize: 14, fontWeight: 700 }}>
              {solicitacoes.length}
            </span>
          )}
        </button>
        <button className={`admin__tab${activeTab === 'realizadas' ? ' admin__tab--active' : ''}`} onClick={() => setActiveTab('realizadas')}>
          ✅ Realizadas
        </button>
        <button className={`admin__tab${activeTab === 'agenda' ? ' admin__tab--active' : ''}`} onClick={() => setActiveTab('agenda')}>
          📅 Agenda
        </button>
        <button className={`admin__tab${activeTab === 'reembolsos' ? ' admin__tab--active' : ''}`} onClick={() => setActiveTab('reembolsos')}>
          💰 Reembolsos
        </button>
      </nav>

      {/* ── Totalizadores ── */}
      {!loadingTabs && (
        <div className="admin__totais">
          <div className="admin__total-card">
            <span className="admin__total-label">Leituras Gratuitas</span>
            <span className="admin__total-valor">
              {[...solicitacoes, ...realizadas].filter(c => c.tipo === 'gratuita').length}
            </span>
          </div>
          <div className="admin__total-card">
            <span className="admin__total-label">Consultas Premium</span>
            <span className="admin__total-valor">
              {[...solicitacoes, ...realizadas].filter(c => c.tipo === 'premium').length}
            </span>
          </div>
          <div className="admin__total-card">
            <span className="admin__total-label">Agendamentos Hoje</span>
            <span className="admin__total-valor">{agendamentosHoje}</span>
          </div>
        </div>
      )}

    <main className="admin__content">
          {activeTab === 'solicitacoes' && (
          loadingTabs
            ? <div className="admin__empty"><div className="admin__empty-title">Carregando...</div></div>
            : <SolicitacoesTab items={solicitacoes} onSelect={setWorkConsultation} />
          )}
          {activeTab === 'realizadas' && (
            loadingTabs
              ? <div className="admin__empty"><div className="admin__empty-title">Carregando...</div></div>
              : <RealizadasTab items={realizadas} />
          )}
        {activeTab === 'agenda' && <AgendaTab />}
        {activeTab === 'reembolsos' && <ReembolsosTab />}
      </main>
    </div>
  )
}

/* ─────────────────────────────────────────────
   ABA SOLICITAÇÕES
───────────────────────────────────────────── */

function SolicitacoesTab({ items, onSelect }: { items: MockConsultation[]; onSelect: (c: MockConsultation) => void }) {
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
        <h1 className="admin__section-title">Solicitações de Leituras</h1>
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
                <span className="admin__card-cta">Abrir e fazer leitura →</span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   ABA REALIZADAS
───────────────────────────────────────────── */

function RealizadasTab({ items }: { items: MockConsultation[] }) {
  if (items.length === 0) {
    return (
      <div className="admin__empty">
        <div className="admin__empty-icon">📚</div>
        <div className="admin__empty-title">Nenhuma leitura realizada ainda</div>
      </div>
    )
  }

  return (
    <>
      <div className="admin__section-header">
        <h1 className="admin__section-title">Leituras Realizadas</h1>
        <p className="admin__section-sub">{items.length} leitura{items.length !== 1 ? 's' : ''} concluída{items.length !== 1 ? 's' : ''}</p>
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

/* ─────────────────────────────────────────────
   ABA AGENDA (com dados reais do Supabase)
───────────────────────────────────────────── */

function AgendaTab() {
  const supabase = createClient()
  const [weekBase, setWeekBase] = useState(new Date())
  const [blocks, setBlocks] = useState<AgendaBlock[]>([])
  const [consultasAgendadas, setConsultasAgendadas] = useState<AgendaConsultation[]>([])
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [consultaSelecionada, setConsultaSelecionada] = useState<AgendaConsultation | null>(null)

  const weekDays = getWeekDays(weekBase)

  // Carregar dados reais
  useEffect(() => {
    
    async function carregar() {
      
      setLoading(true)
      const inicio = weekDays[0].toISOString()
      const fim = new Date(weekDays[5].getTime() + 24 * 60 * 60 * 1000).toISOString()

      // Bloqueios
      const { data: bloqueios } = await supabase
        .from('agenda_blocks')
        .select('id, starts_at, ends_at, reason, type')
        .lte('starts_at', fim)
        .gte('ends_at', inicio)

      // Consultas agendadas com dados do cliente
      const { data: consultas } = await supabase
        .from('consultations')
        .select('id, scheduled_at, status, user_id, profiles(full_name, email)')
        .in('status', ['agendada', 'em_andamento'])
        .gte('scheduled_at', inicio)
        .lte('scheduled_at', fim)

      setBlocks(bloqueios ?? [])
      setConsultasAgendadas(
        (consultas ?? []).map((c: any) => ({
          id: c.id,
          scheduled_at: c.scheduled_at,
          status: c.status,
          client_name: c.profiles?.full_name ?? 'Cliente',
          client_email: c.profiles?.email ?? '',
        }))
      )
      setLoading(false)
      console.log('Bloqueios:', bloqueios)
      console.log('Consultas:', consultas)
    }
    carregar()
  }, [weekBase])

  const isBlocked = (day: Date, time: string): boolean => {
    const [h, m] = time.split(':').map(Number)
    const slotStart = new Date(day)
    slotStart.setHours(h, m, 0, 0)
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000)
    return blocks.some(b => {
      const bStart = new Date(b.starts_at)
      const bEnd = new Date(b.ends_at)
      return slotStart < bEnd && slotEnd > bStart
    })
  }

  const getConsulta = (day: Date, time: string): AgendaConsultation | null => {
    const [h, m] = time.split(':').map(Number)
    const slotStart = new Date(day)
    slotStart.setHours(h, m, 0, 0)
    return consultasAgendadas.find(c => {
      const cStart = new Date(c.scheduled_at)
      return Math.abs(cStart.getTime() - slotStart.getTime()) < 60 * 1000
    }) ?? null
  }

  const isToday = (day: Date) => day.toDateString() === new Date().toDateString()

  const prevWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d) }
  const nextWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d) }

  const weekLabel = `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${weekDays[5].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`

  async function salvarBloqueio(block: Omit<AgendaBlock, 'id'>) {
    const { data } = await supabase
      .from('agenda_blocks')
      .insert(block)
      .select()
      .single()
    if (data) setBlocks(prev => [...prev, data])
    setShowBlockModal(false)
  }

  async function removerBloqueio(id: string) {
    await supabase.from('agenda_blocks').delete().eq('id', id)
    setBlocks(prev => prev.filter(b => b.id !== id))
  }

  return (
    <>
      <div className="admin__section-header">
        <h1 className="admin__section-title">Agenda</h1>
        <p className="admin__section-sub">Segunda a Sábado · 9h às 18h · Consultas de 30 minutos</p>
      </div>

      <div className="agenda">
        <div className="agenda__calendar">
          <div className="agenda__cal-header">
            <button className="agenda__cal-nav" onClick={prevWeek}>‹</button>
            <span className="agenda__cal-week">{weekLabel}</span>
            <button className="agenda__cal-nav" onClick={nextWeek}>›</button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 16 }}>Carregando agenda...</div>
          ) : (
            <div className="agenda__grid">
              <div className="agenda__grid-day-header" />
              {weekDays.map((day, i) => (
                <div key={i} className={`agenda__grid-day-header${isToday(day) ? ' agenda__grid-day-header--today' : ''}`}>
                  {DAY_NAMES[i]}<br />
                  <strong style={{ fontSize: 18 }}>{day.getDate()}</strong>
                </div>
              ))}

              {TIME_SLOTS.map(time => (
                <Fragment key={time}>
                  <div className="agenda__grid-time">{time}</div>
                  {weekDays.map((day, di) => {
                    const blocked = isBlocked(day, time)
                    const consulta = getConsulta(day, time)
                    const disponivel = chatDisponivel(
                      (() => {
                        const d = new Date(day)
                        const [h, m] = time.split(':').map(Number)
                        d.setHours(h, m, 0, 0)
                        return d.toISOString()
                      })()
                    )

                    return (
                      <div
                        key={`${time}-${di}`}
                        className={`agenda__grid-cell${blocked ? ' agenda__grid-cell--blocked' : ''}${consulta ? ' agenda__grid-cell--agendada' : ''}`}
                        onClick={() => consulta && setConsultaSelecionada(consulta)}
                        style={{ cursor: consulta ? 'pointer' : 'default' }}
                      >
                        {blocked && <div className="agenda__event agenda__event--bloqueado">🚫 Bloqueado</div>}
                        {consulta && (
                          <div className={`agenda__event agenda__event--consulta${disponivel ? ' agenda__event--ativa' : ''}`}>
                            {disponivel ? '🟢' : '👤'} {consulta.client_name.split(' ')[0]}
                            {disponivel && (
                              <a
                                href={`/dashboard/chat/${consulta.id}`}
                                className="agenda__event-entrar"
                                onClick={e => e.stopPropagation()}
                              >
                                Entrar →
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="agenda__sidebar">
          <div className="agenda__panel">
            <div className="agenda__panel-header"><div className="agenda__panel-title">⚙️ Configurações da Agenda</div></div>
            <div className="agenda__panel-body">
              <div className="agenda__config-row"><span className="agenda__config-label">Dias de atendimento</span><span className="agenda__config-value">Segunda a Sábado</span></div>
              <div className="agenda__config-row"><span className="agenda__config-label">Horário</span><span className="agenda__config-value">9h00 às 18h00</span></div>
              <div className="agenda__config-row"><span className="agenda__config-label">Duração da consulta</span><span className="agenda__config-value">30 minutos</span></div>
              <div className="agenda__config-row"><span className="agenda__config-label">Intervalo</span><span className="agenda__config-value">5 minutos</span></div>
              <div className="agenda__config-row"><span className="agenda__config-label">Slots por dia</span><span className="agenda__config-value">{TIME_SLOTS.length} horários</span></div>
            </div>
          </div>

          <div className="agenda__panel">
            <div className="agenda__panel-header"><div className="agenda__panel-title">🚫 Bloquear Horários</div></div>
            <div className="agenda__panel-body">
              <button className="agenda__btn-block" onClick={() => setShowBlockModal(true)}>🚫 Bloquear um dia ou horário</button>
              {blocks.length === 0 ? (
                <p style={{ fontSize: 16, color: 'var(--muted)', fontStyle: 'italic' }}>Nenhum bloqueio cadastrado.</p>
              ) : (
                blocks.map(b => (
                  <div key={b.id} className="agenda__block-item">
                    <div className="agenda__block-info">
                    <div className="agenda__block-date" suppressHydrationWarning>
                      {formatShortDate(b.starts_at)}
                      {b.starts_at.slice(0, 10) !== b.ends_at.slice(0, 10) && ` → ${formatShortDate(b.ends_at)}`}
                    </div>
                      <div className="agenda__block-reason">{b.reason || 'Sem motivo'}</div>
                    </div>
                    <button className="agenda__block-remove" onClick={() => removerBloqueio(b.id)}>✕</button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="agenda__panel">
            <div className="agenda__panel-header"><div className="agenda__panel-title">📌 Legenda</div></div>
            <div className="agenda__panel-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(21,87,36,0.2)', border: '2px solid #155724', display: 'inline-block' }} />
                  Consulta agendada
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(192,57,43,0.15)', border: '2px solid #c0392b', display: 'inline-block' }} />
                  Bloqueado
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal detalhe consulta */}
      {consultaSelecionada && (
        <div className="modal-overlay" onClick={() => setConsultaSelecionada(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__icon">👤</div>
            <h2 className="modal__title">{consultaSelecionada.client_name}</h2>
            <p className="modal__text" suppressHydrationWarning>
              📧 {consultaSelecionada.client_email}<br />
              🕐 {formatDate(consultaSelecionada.scheduled_at)}<br />
              Status: {consultaSelecionada.status}
            </p>
            {chatDisponivel(consultaSelecionada.scheduled_at) && (
              <a href={`/dashboard/chat/${consultaSelecionada.id}`} className="modal__btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                🟢 Entrar na Consulta
              </a>
            )}
            <button className="modal__btn-secondary" onClick={() => setConsultaSelecionada(null)}>Fechar</button>
          </div>
        </div>
      )}

      {showBlockModal && (
        <BlockModal onClose={() => setShowBlockModal(false)} onSave={salvarBloqueio} />
      )}
    </>
  )
}

/* ─────────────────────────────────────────────
   ABA REEMBOLSOS
───────────────────────────────────────────── */

function ReembolsosTab() {
  const supabase = createClient()
  const [reembolsos, setReembolsos] = useState<ReembolsoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      const { data, error } = await supabase
        .from('credits')
        .select('id, user_id, amount, status, created_at, refund_requested_at, profiles(full_name, email)')
        .eq('status', 'refund_requested')
        .order('refund_requested_at', { ascending: true })
        console.log('Reembolsos data:', data)  // ← adicionar
        console.log('Reembolsos error:', error) // ← adicionar
      setReembolsos(
        (data ?? []).map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          amount: r.amount,
          status: r.status,
          created_at: r.created_at,
          refund_requested_at: r.refund_requested_at,
          client_name: r.profiles?.full_name ?? 'Cliente',
          client_email: r.profiles?.email ?? '',
        }))
      )
      setLoading(false)
    }
    carregar()
    
  }, [])
  

  async function handleMarcarReembolsado(creditId: string) {
    setMarcando(creditId)
    try {
      const res = await fetch('/api/admin/marcar-reembolso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditId }),
      })
      if (res.ok) {
        setReembolsos(prev => prev.filter(r => r.id !== creditId))
        showToast('✅ Reembolso marcado como concluído.')
      } else {
        showToast('❌ Erro ao marcar reembolso.')
      }
    } catch {
      showToast('❌ Erro de conexão.')
    } finally {
      setMarcando(null)
    }
  }

  return (
    <>
      <div className="admin__section-header">
        <h1 className="admin__section-title">Reembolsos Pendentes</h1>
        <p className="admin__section-sub">Clientes que solicitaram reembolso em dinheiro. Prazo: 48h úteis.</p>
      </div>

      {loading ? (
        <div className="admin__empty">
          <div className="admin__empty-title">Carregando...</div>
        </div>
      ) : reembolsos.length === 0 ? (
        <div className="admin__empty">
          <div className="admin__empty-icon">💰</div>
          <div className="admin__empty-title">Nenhum reembolso pendente</div>
          <div className="admin__empty-text">Quando clientes solicitarem reembolso, aparecerão aqui.</div>
        </div>
      ) : (
        <div className="admin__cards">
          {reembolsos.map(r => (
            <div key={r.id} className="admin__card">
              <div className="admin__card-body">
                <div className="admin__card-name">{r.client_name}</div>
                <div className="admin__card-meta">
                  <span>📧 {r.client_email}</span>
                  <span>💰 R$ {Number(r.amount).toFixed(2)}</span>
                  {r.refund_requested_at && <span suppressHydrationWarning>📅 Solicitado em: {formatDate(r.refund_requested_at)}</span>}
                </div>
                <p style={{ fontSize: 14, color: 'var(--muted)', margin: '8px 0 0', fontStyle: 'italic' }}>
                  Faça o estorno manualmente no painel do Mercado Pago antes de marcar como concluído.
                </p>
              </div>
              <div className="admin__card-actions">
                <button
                  className="modal__btn-primary"
                  style={{ fontSize: 16, padding: '10px 20px' }}
                  onClick={() => handleMarcarReembolsado(r.id)}
                  disabled={marcando === r.id}
                >
                  {marcando === r.id ? 'Processando...' : '✅ Marcar como Reembolsado'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      

      {toast && <div className="toast"><span>{toast}</span></div>}
    </>
  )
}

/* ─────────────────────────────────────────────
   MODAL BLOQUEAR HORÁRIO
───────────────────────────────────────────── */

function BlockModal({ onClose, onSave }: { onClose: () => void; onSave: (block: Omit<AgendaBlock, 'id'>) => void }) {
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

/* ─────────────────────────────────────────────
   MODAL CANCELAR (ESPECIALISTA)
───────────────────────────────────────────── */

function CancelModal({ clientName, onClose, onConfirm }: { clientName: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
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
        <p className="modal__text">O cliente receberá um crédito de <strong>R$ 100,00</strong> automaticamente.</p>
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

/* ─────────────────────────────────────────────
   MODAL RECUSAR FOTOS
───────────────────────────────────────────── */

function RefuseModal({ clientName, onClose, onConfirm }: { clientName: string; onClose: () => void; onConfirm: (reason: string) => void }) {
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

/* ─────────────────────────────────────────────
   TELA DE TRABALHO
───────────────────────────────────────────── */

function WorkView({ consultation, onBack }: { consultation: MockConsultation; onBack: () => void }) {
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
      showToast('✅ Leitura enviada com sucesso para ' + consultation.client_name + '!')
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
          <div className="work__title">Fazendo a Leitura</div>
          <div className="work__client-name">{consultation.client_name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(() => { const sla = getSlaInfo(consultation.created_at); return <span className={`admin__badge ${sla.badgeClass}`}>{sla.label}</span> })()}
        </div>
      </header>

      <div className="work__main">
        <div className="work__photos">
          <div className="work__photos-header">
            <div className="work__photos-title">📸 Fotos das Mãos</div>
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
                    {activePhoto.hand_type === 'direita' ? '👋 Mão Direita'
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
              {activePhoto.hand_type === 'direita' ? '👋 Mão Direita' : activePhoto.hand_type === 'esquerda' ? '🤚 Mão Esquerda' : '🖐 Perfil'} — Foto {activePhotoIdx + 1} de {consultation.photos.length}
            </div>
          )}
         {consultation.photos.length > 1 && (
          <div className="work__thumbnails">
            {(['direita', 'esquerda', 'perfil'] as const).map(hand => {
              const grupo = consultation.photos.filter(p => p.hand_type === hand)
              if (grupo.length === 0) return null
              const grupoLabel = hand === 'direita' ? '👋 Mão Direita' : hand === 'esquerda' ? '🤚 Mão Esquerda' : '🖐 Perfil'
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
            <div className="work__pad-title">📝 Prancheta de Leitura</div>
            <div className="work__pad-info">
              <span className="work__pad-client">Cliente: <strong>{consultation.client_name}</strong> · {consultation.birth_date} · {consultation.hand_dominance}</span>
              <span className={`work__autosave${autosaveStatus === 'saved' ? ' work__autosave--saved' : ''}`}>{autosaveStatus === 'saved' ? '✓ Rascunho salvo' : 'Digitando...'}</span>
            </div>
          </div>
          <textarea className="work__textarea" placeholder="Escreva aqui a leitura da mão desta pessoa..." value={reading} onChange={e => handleReadingChange(e.target.value)} />
          <div className="work__pad-footer">
            <button className="work__btn-refuse" onClick={() => setShowRefuseModal(true)}>❌ Recusar Fotos</button>
            <button className="work__btn-cancel" onClick={() => setShowCancelModal(true)}>🚫 Cancelar Consulta</button>
            <button className="work__btn-send" onClick={() => setShowSendModal(true)} disabled={reading.trim().length < 10}>✉️ Enviar Leitura</button>
          </div>
        </div>
      </div>

      {showSendModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal__icon">✉️</div>
            <h2 className="modal__title">Enviar leitura para {consultation.client_name}?</h2>
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

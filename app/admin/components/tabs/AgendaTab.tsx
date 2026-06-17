'use client'
import { Fragment, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { BlockModal } from '../modals/BlockModal'
import {
  formatDate,
  formatShortDate,
  chatDisponivel,
  getWeekDays,
  TIME_SLOTS,
  DAY_NAMES,
} from '../../helpers'
import type { AgendaBlock, AgendaConsultation } from '../../types'

/* ─────────────────────────────────────────────
   ABA AGENDA (com dados reais do Supabase)
───────────────────────────────────────────── */

export function AgendaTab() {
  const supabase = createClient()
  const [weekBase, setWeekBase] = useState(new Date())
  const [blocks, setBlocks] = useState<AgendaBlock[]>([])
  const [consultasAgendadas, setConsultasAgendadas] = useState<AgendaConsultation[]>([])
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [consultaSelecionada, setConsultaSelecionada] = useState<AgendaConsultation | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const weekDays = getWeekDays(weekBase)

  // Carregar dados reais
  useEffect(() => {

    async function carregar() {

      setLoading(true)
      const inicio = weekDays[0].toISOString()
      const fim = new Date(weekDays[5].getTime() + 24 * 60 * 60 * 1000).toISOString()

      // Bloqueios
      const { data: bloqueios, error: blocksError } = await supabase
        .from('agenda_blocks')
        .select('id, starts_at, ends_at, reason, type')
        .lte('starts_at', fim)
        .gte('ends_at', inicio)

      // Consultas agendadas com dados do cliente
      const { data: consultas, error: consultasError } = await supabase
        .from('consultations')
        .select('id, scheduled_at, status, user_id, profiles(full_name, email)')
        .in('status', ['agendada', 'em_andamento'])
        .gte('scheduled_at', inicio)
        .lte('scheduled_at', fim)

      if (blocksError || consultasError) {
        showToast('❌ Erro ao carregar agenda. Tente novamente.')
        setLoading(false)
        return
      }

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
    const { data, error } = await supabase
      .from('agenda_blocks')
      .insert(block)
      .select()
      .single()
    if (error || !data) { showToast('❌ Erro ao salvar bloqueio.'); return }
    setBlocks(prev => [...prev, data])
    setShowBlockModal(false)
  }

  async function removerBloqueio(id: string) {
    const { error } = await supabase.from('agenda_blocks').delete().eq('id', id)
    if (error) { showToast('❌ Erro ao remover bloqueio.'); return }
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

      {toast && <div className="toast"><span>{toast}</span></div>}
    </>
  )
}

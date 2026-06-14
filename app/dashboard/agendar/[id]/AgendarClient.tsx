'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'calendario' | 'confirmacao' | 'sucesso'

function getSemana(base: Date): Date[] {
  const dias: Date[] = []
  // Encontrar segunda-feira da semana atual
  const d = new Date(base)
  const dow = d.getDay() // 0=Dom
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  for (let i = 0; i < 6; i++) { // Seg a Sáb
    dias.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return dias
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatMesAno(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
}

function formatDiaSemana(d: Date): string {
  return d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' })
    .replace('.', '').toUpperCase()
}

function formatDiaNum(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' })
}

function formatSlotHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  })
}

function formatDataCompleta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
    timeZone: 'America/Sao_Paulo',
  })
}

function isHoje(d: Date): boolean {
  const hoje = new Date()
  return d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear()
}

function isPassado(d: Date): boolean {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const cmp = new Date(d)
  cmp.setHours(0, 0, 0, 0)
  return cmp < hoje
}

export default function AgendarClient({ consultationId }: { consultationId: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('calendario')

  // Calendário
  const hoje = new Date()
  const [semanaBase, setSemanaBase] = useState<Date>(hoje)
  const dias = getSemana(semanaBase)
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null)

  // Slots
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [erroSlots, setErroSlots] = useState('')
  const [slotSelecionado, setSlotSelecionado] = useState<string | null>(null)

  // Confirmação
  const [confirmando, setConfirmando] = useState(false)
  const [erroConfirm, setErroConfirm] = useState('')

  function semanaAnterior() {
    const d = new Date(semanaBase)
    d.setDate(d.getDate() - 7)
    setSemanaBase(d)
    setDiaSelecionado(null)
    setSlots([])
    setErroSlots('')
  }

  function proximaSemana() {
    const d = new Date(semanaBase)
    d.setDate(d.getDate() + 7)
    setSemanaBase(d)
    setDiaSelecionado(null)
    setSlots([])
    setErroSlots('')
  }

  async function handleSelecionarDia(dia: Date) {
    if (isPassado(dia)) return
    setDiaSelecionado(dia)
    setSlotSelecionado(null)
    setSlots([])
    setErroSlots('')
    setLoadingSlots(true)

    try {
      const res = await fetch(`/api/available-slots?date=${toDateStr(dia)}`)
      const data = await res.json()
      if (!res.ok) { setErroSlots(data.error ?? 'Erro ao buscar horários.'); return }
      if (!data.slots || data.slots.length === 0) {
        setErroSlots('Nenhum horário disponível neste dia.')
      } else {
        setSlots(data.slots)
      }
    } catch {
      setErroSlots('Erro de conexão. Tente novamente.')
    } finally {
      setLoadingSlots(false)
    }
  }

  function handleSelecionarSlot(slot: string) {
    setSlotSelecionado(slot)
    setStep('confirmacao')
  }

  async function handleConfirmar() {
    if (!slotSelecionado) return
    setConfirmando(true)
    setErroConfirm('')
    try {
      const res = await fetch('/api/agendar-consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId, startsAt: slotSelecionado }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErroConfirm(data.error ?? 'Erro ao agendar.')
        if (res.status === 409) {
          setStep('calendario')
          setSlotSelecionado(null)
          if (diaSelecionado) handleSelecionarDia(diaSelecionado)
        }
        return
      }
      setStep('sucesso')
    } catch {
      setErroConfirm('Erro de conexão. Tente novamente.')
    } finally {
      setConfirmando(false)
    }
  }

  // Label do intervalo da semana
  const inicioSemana = dias[0]
  const fimSemana = dias[5]
  const mesLabel = inicioSemana.getMonth() === fimSemana.getMonth()
    ? formatMesAno(inicioSemana)
    : `${inicioSemana.toLocaleDateString('pt-BR', { month: 'short' })} — ${formatMesAno(fimSemana)}`

  const semanaPassada = (() => {
    const seg = new Date(dias[0])
    seg.setHours(0, 0, 0, 0)
    const hojeZ = new Date()
    hojeZ.setHours(0, 0, 0, 0)
    return seg <= hojeZ
  })()

  return (
    <div className="agendar-root">

      {/* ── Header ── */}
      <header className="agendar-header">
        <button className="agendar-back" onClick={() => router.push('/dashboard')}>
          <span className="agendar-back-arrow">←</span>
          <span>Voltar</span>
        </button>
        <span className="agendar-logo">ConsultaViva</span>
      </header>

      {/* ── Sucesso ── */}
      {step === 'sucesso' && (
        <main className="agendar-main agendar-main--sucesso">
          <div className="agendar-sucesso-ornament">✦</div>
          <p className="agendar-sucesso-eyebrow">Confirmado!</p>
          <h1 className="agendar-sucesso-titulo">Consulta agendada</h1>
          {slotSelecionado && (
            <div className="agendar-sucesso-info">
              <p className="agendar-sucesso-data">{formatDataCompleta(slotSelecionado)}</p>
              <p className="agendar-sucesso-hora">{formatSlotHora(slotSelecionado)}</p>
              <p className="agendar-sucesso-duracao">Duração: 30 minutos</p>
            </div>
          )}
          <p className="agendar-sucesso-desc">
            O acesso à sala de consulta ficará disponível 5 minutos antes do horário agendado.
          </p>
          <button
            className="agendar-btn-primary"
            onClick={() => router.push('/dashboard')}
          >
            Ir para o dashboard →
          </button>
        </main>
      )}

      {/* ── Confirmação ── */}
      {step === 'confirmacao' && slotSelecionado && (
        <main className="agendar-main">
          <div className="agendar-section-header">
            <p className="agendar-eyebrow">Consulta Premium</p>
            <h1 className="agendar-titulo">Confirmar agendamento</h1>
          </div>

          <div className="agendar-confirm-card">
            <div className="agendar-confirm-ornament">◈</div>
            <p className="agendar-confirm-data">{formatDataCompleta(slotSelecionado)}</p>
            <p className="agendar-confirm-hora">{formatSlotHora(slotSelecionado)}</p>
            <p className="agendar-confirm-duracao">30 minutos · Consulta ao vivo</p>
          </div>

          <p className="agendar-aviso-politica">
            Cancelamentos devem ser solicitados com pelo menos 24h de antecedência
            para gerar crédito automaticamente.
          </p>

          {erroConfirm && <p className="agendar-erro">{erroConfirm}</p>}

          <button
            className="agendar-btn-primary"
            onClick={handleConfirmar}
            disabled={confirmando}
          >
            {confirmando ? 'Confirmando...' : 'Confirmar agendamento'}
          </button>

          <button
            className="agendar-btn-ghost"
            onClick={() => { setStep('calendario'); setErroConfirm('') }}
          >
            Voltar e escolher outro horário
          </button>
        </main>
      )}

      {/* ── Calendário ── */}
      {step === 'calendario' && (
        <main className="agendar-main">
          <div className="agendar-section-header">
            <p className="agendar-eyebrow">Consulta Premium</p>
            <h1 className="agendar-titulo">Escolha um horário</h1>
            <p className="agendar-subtitulo">Selecione o dia e depois o horário disponível</p>
          </div>

          {/* Navegação de semana */}
          <div className="agendar-semana-nav">
            <button
              className="agendar-nav-btn"
              onClick={semanaAnterior}
              disabled={semanaPassada}
            >
              ‹
            </button>
            <span className="agendar-mes-label">{mesLabel}</span>
            <button className="agendar-nav-btn" onClick={proximaSemana}>
              ›
            </button>
          </div>

          {/* Grid de dias */}
          <div className="agendar-dias-grid">
            {dias.map((dia, i) => {
              const passado = isPassado(dia)
              const selecionado = diaSelecionado && toDateStr(dia) === toDateStr(diaSelecionado)
              const hoje = isHoje(dia)
              return (
                <button
                  key={i}
                  className={[
                    'agendar-dia-btn',
                    passado ? 'passado' : '',
                    selecionado ? 'selecionado' : '',
                    hoje ? 'hoje' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleSelecionarDia(dia)}
                  disabled={passado}
                >
                  <span className="agendar-dia-semana">{formatDiaSemana(dia)}</span>
                  <span className="agendar-dia-num">{formatDiaNum(dia)}</span>
                </button>
              )
            })}
          </div>

          {/* Slots */}
          <div className="agendar-slots-wrap">
            {!diaSelecionado && (
              <p className="agendar-slots-hint">← Selecione um dia para ver os horários</p>
            )}

            {diaSelecionado && loadingSlots && (
              <div className="agendar-slots-loading">
                <div className="agendar-spinner" />
                <span>Carregando horários...</span>
              </div>
            )}

            {diaSelecionado && !loadingSlots && erroSlots && (
              <div className="agendar-slots-vazio">
                <span className="agendar-slots-vazio-icon">◎</span>
                <p>{erroSlots}</p>
              </div>
            )}

            {diaSelecionado && !loadingSlots && slots.length > 0 && (
              <>
                <p className="agendar-slots-label">
                  Horários disponíveis — {formatDataCompleta(slotSelecionado ?? diaSelecionado.toISOString())}
                </p>
                <div className="agendar-slots-grid">
                  {slots.map(slot => (
                    <button
                      key={slot}
                      className="agendar-slot-btn"
                      onClick={() => handleSelecionarSlot(slot)}
                    >
                      {formatSlotHora(slot)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      )}

      <footer className="agendar-footer">
        <p>ConsultaViva</p>
      </footer>
    </div>
  )
}

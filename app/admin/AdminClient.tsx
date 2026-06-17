'use client'
import { useState, useEffect } from 'react'
import './admin.css'
import { SolicitacoesTab } from './components/tabs/SolicitacoesTab'
import { RealizadasTab } from './components/tabs/RealizadasTab'
import { AgendaTab } from './components/tabs/AgendaTab'
import { ReembolsosTab } from './components/tabs/ReembolsosTab'
import { WorkView } from './components/WorkView'
import type { Tab, MockConsultation } from './types'

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

        const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
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
            <span className="admin__total-label">Consulta Avaliativa</span>
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

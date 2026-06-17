'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { formatDate } from '../../helpers'
import type { ReembolsoItem } from '../../types'

/* ─────────────────────────────────────────────
   ABA REEMBOLSOS
───────────────────────────────────────────── */

export function ReembolsosTab() {
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
      if (error) { showToast('❌ Erro ao carregar reembolsos.'); setLoading(false); return }
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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VALOR_CONSULTA } from '@/lib/constants'
import './dashboard.css'

import { saudacao, formatDate, formatDateShort, chatDisponivel, labelStatusCredito } from './helpers'
import { POLITICAS } from './politicas-data'
import type { Politica, Props } from './types'

import { ModalPerfil } from './components/modals/ModalPerfil'
import { ModalPix } from './components/modals/ModalPix'
import { ModalPolitica } from './components/modals/ModalPolitica'
import { ModalCancelarConsulta } from './components/modals/ModalCancelarConsulta'
import { LogoutBtn } from './components/LogoutBtn'

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardClient({
  userName,
  userInitials,
  userEmail,
  userFullName,
  consultation,
  historico,
  creditos,
}: Props) {
  const router = useRouter()
  const [modalPerfil, setModalPerfil] = useState(false)
  const [modalPolitica, setModalPolitica] = useState<Politica | null>(null)
  const [modalPix, setModalPix] = useState(false)
  const [modalCancelar, setModalCancelar] = useState(false)
  const [solicitandoReembolso, setSolicitandoReembolso] = useState<string | null>(null)
  const [reembolsoErro, setReembolsoErro] = useState<string | null>(null)

  function handleIniciarLeitura() {
    router.push('/dashboard/triagem')
  }

  async function handleSolicitarReembolso(creditId: string) {
    setSolicitandoReembolso(creditId)
    setReembolsoErro(null)
    try {
      const res = await fetch('/api/solicitar-reembolso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditId }),
      })
      if (res.ok) router.refresh()
      else setReembolsoErro('Erro ao solicitar reembolso. Tente novamente.')
    } catch {
      setReembolsoErro('Erro de conexão.')
    } finally {
      setSolicitandoReembolso(null)
    }
  }

  const status = consultation?.status ?? null
  const primeiroNome = userName.split(' ')[0]

  let estado: 0 | 1 | '1b' | 2 | 3 = 0
  if (status === 'fotos_recusadas') estado = '1b'
  else if (status === 'triagem' || status === 'aguardando_analise') estado = 1
  else if (status === 'concluida') estado = 2
  else if (status === 'agendada' || status === 'em_andamento') estado = 3

  const chatAtivo = estado === 3 
  && consultation?.status !== 'concluida'
  && chatDisponivel(consultation?.scheduled_at ?? null)

  const linhasAnalise = consultation?.analysis_summary?.split('\n').filter(Boolean) ?? []
  const previewAnalise = linhasAnalise.slice(0, 3).join('\n')

  const creditoDisponivel = creditos.filter(c => c.status === 'available').length > 0

  return (
    <>
      {modalPerfil && <ModalPerfil onClose={() => setModalPerfil(false)} userFullName={userFullName} userEmail={userEmail} />}
      {modalPolitica && <ModalPolitica politica={modalPolitica} onClose={() => setModalPolitica(null)} />}
      {modalPix && consultation && (
        <ModalPix
          consultationId={consultation.id}
          userEmail={userEmail}
          userName={userName}
          onClose={() => setModalPix(false)}
          onPago={() => { setModalPix(false); router.refresh() }}
        />
      )}
      {modalCancelar && consultation && (
        <ModalCancelarConsulta
          consultationId={consultation.id}
          onClose={() => setModalCancelar(false)}
          onCancelado={() => { setModalCancelar(false); router.refresh() }}
        />
      )}

      <div className="dash-root">

        {/* ── Header ── */}
        <header className="dash-header">
          <span className="dash-logo">ConsultaViva</span>
          <div className="dash-header-right">
            <span className="dash-header-name">{primeiroNome}</span>
            <button className="dash-avatar" onClick={() => setModalPerfil(true)} title="Editar perfil">{userInitials}</button>
            <LogoutBtn />
          </div>
        </header>

        <main className="dash-main">

          {/* ── Saudação ── */}
          <section className="dash-greeting">
            <p className="dash-eyebrow">Área do Cliente</p>
            <h1 className="dash-title">{saudacao()}, {primeiroNome}</h1>
          </section>

          {/* ── Estado 0 — Sem consulta ── */}
          {estado === 0 && (
            <section className="dash-section">
              <div className="status-card status-card--idle">
                <div className="status-ornament">✦</div>
                
                    <p className="status-eyebrow">Comece agora</p>
                    <h2 className="status-heading">Agende sua Consulta Premium</h2>
                    <p className="status-body">30 minutos em sessão privada ao vivo com nossa especialista de mais de 38 anos de experiência. Após o pagamento via PIX, você escolhe o melhor horário.</p>
                    <button className="btn-primary btn-primary--lg btn-premium" onClick={handleIniciarLeitura}>Iniciar minha triagem</button>
              </div>
            </section>
          )}

          {/* ── Estado 1 — Triagem / Aguardando análise ── */}
          {estado === 1 && (
            <section className="dash-section">
              <div className="status-card status-card--pending">
                <div className="status-ornament status-ornament--pulse">◈</div>
                <p className="status-eyebrow">Solicitação Recebida</p>
                <h2 className="status-heading">Sua avaliação está em andamento</h2>
                <p className="status-body">Recebemos suas informações e materiais. Nossa especialista está preparando sua avaliação com atenção. O prazo é de até <strong>48 horas</strong>.</p>
                <div className="status-progress">
                  <div className="status-progress-step done"><span className="step-dot-sm">✓</span><span>Triagem concluída</span></div>
                  <div className="status-progress-line" />
                  <div className="status-progress-step active"><span className="step-dot-sm pulse">◉</span><span>Em avaliação</span></div>
                  <div className="status-progress-line muted" />
                  <div className="status-progress-step"><span className="step-dot-sm muted">◎</span><span className="muted">Avaliação pronta</span></div>
                </div>
                <div className="status-badge"><span className="badge-dot" /> Aguardando avaliação</div>
              </div>
            </section>
          )}

          {/* ── Estado 1b — Fotos Recusadas ── */}
          {estado === '1b' && (
            <section className="dash-section">
              <div className="status-card status-card--rejected">
                <div className="rejected-icon">⚠</div>
                <p className="status-eyebrow rejected-eyebrow">Atenção necessária</p>
                <h2 className="status-heading">Seus materiais precisam ser reenviados</h2>
                {consultation?.photo_rejection_reason && (
                  <div className="rejected-reason-box">
                    <p className="rejected-reason-label">Motivo informado pela especialista:</p>
                    <p className="rejected-reason-text">{consultation.photo_rejection_reason}</p>
                  </div>
                )}
                {(consultation?.photo_rejection_count ?? 0) > 1 && (
                  <p className="rejected-count-note">Esta é a {consultation!.photo_rejection_count}ª solicitação de reenvio.</p>
                )}
                <p className="status-body">Para garantir uma análise precisa, precisamos de materiais nítidos e de boa qualidade. Ao reenviar, os materiais anteriores serão substituídos.</p>
                <div className="rejected-tips">
                  <p className="rejected-tips-title">Dicas para um bom envio:</p>
                  <ul className="rejected-tips-list">
                    <li>📸 Imagem nítida e bem enquadrada</li>
                    <li>💡 Iluminação natural ou ambiente bem iluminado</li>
                    <li>🔍 Câmera próxima o suficiente para captar os detalhes</li>
                    <li>🤳 Rosto centralizado e completamente visível</li>
                  </ul>
                </div>
                <button className="btn-primary btn-primary--lg btn-primary--danger" onClick={() => window.location.href = '/dashboard/triagem'}>Reenviar meus materiais →</button>
              </div>
            </section>
          )}

          {/* ── Estado 2 — Concluída ── */}
          {estado === 2 && (
            <section className="dash-section">
              <div className="status-card status-card--done">
                <div className="status-ornament">✦</div>
                <p className="status-eyebrow">Avaliação Concluída</p>
                <h2 className="status-heading">Sua avaliação está pronta</h2>

                {previewAnalise ? (
                  <div className="analysis-preview">
                    <p className="analysis-preview-text">{previewAnalise}</p>
                    <div className="analysis-fade" />
                  </div>
                ) : (
                  <p className="status-body">A análise será exibida em breve.</p>
                )}

                <button className="btn-primary" onClick={() => router.push(`/dashboard/leitura/${consultation?.id}`)}>
                  Ver minha avaliação completa →
                </button>

                {/* CTA Consulta Premium — só aparece se não há crédito disponível */}
                {consultation?.tipo === 'gratuita' && !creditoDisponivel && (
                  <div className="premium-cta-wrap">
                    <p className="premium-cta-label">Quer ir mais fundo?</p>
                    <p className="premium-cta-desc">Agende uma consulta ao vivo de 30 minutos com a especialista.</p>
                    <button className="btn-primary" onClick={() => setModalPix(true)}>
                      Adquirir Consulta Premium — R$ {VALOR_CONSULTA}
                    </button>
                  </div>
                )}

                {/* Crédito disponível */}
                {creditoDisponivel && (
                  <div className="credito-aviso">
                    <span className="credito-aviso-icon">◈</span>
                    <p className="credito-aviso-texto">Você possui <strong>crédito disponível</strong> para uma consulta premium.</p>
                    <button
                      className="btn-primary btn-primary--lg"
                      style={{ marginTop: '12px' }}
                      onClick={() => router.push(`/dashboard/agendar/${consultation?.id}`)}
                    >
                      Agendar minha Consulta →
                    </button>
                  </div>
                )}

                {consultation?.tipo === 'premium' && (
                  <div className="premium-cta-wrap">
                    <p className="premium-cta-label">Gostou da experiência?</p>
                    <p className="premium-cta-desc">Envie novos materiais e agende uma nova consulta.</p>
                    <button
                      className="btn-primary"
                      onClick={() => router.push('/dashboard/triagem-retornante')}
                    >
                      Agendar Nova Consulta →
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Estado 3 — Agendada / Em andamento ── */}
          {estado === 3 && (() => {
            const podeCancel = consultation?.scheduled_at
              ? (new Date(consultation.scheduled_at).getTime() - Date.now()) > 24 * 60 * 60 * 1000
              : false
            return (
              <section className="dash-section">
                <div className="status-card status-card--scheduled">
                  <div className="status-ornament">◈</div>
                  <p className="status-eyebrow">Consulta Agendada</p>
                  <h2 className="status-heading">Sua consulta premium</h2>
                  {consultation?.scheduled_at && (
                    <p className="status-date">{formatDate(consultation.scheduled_at)}</p>
                  )}
                  <p className="status-body">
                    {chatAtivo
                      ? 'Sua consulta está disponível agora. Entre na sala.'
                      : 'O acesso à sala ficará disponível 5 minutos antes do horário agendado.'}
                  </p>
                  <button
                    className={`btn-primary btn-primary--lg${!chatAtivo ? ' btn-primary--disabled' : ''}`}
                    disabled={!chatAtivo}
                    onClick={() => chatAtivo && router.push(`/dashboard/chat/${consultation?.id}`)}
                  >
                    {chatAtivo ? 'Entrar na Consulta' : 'Sala indisponível'}
                  </button>
                  {podeCancel ? (
                    <button className="agenda-cancelar-btn" onClick={() => setModalCancelar(true)}>
                      Cancelar consulta
                    </button>
                  ) : (
                    consultation?.scheduled_at && (
                      <p className="agenda-cancelar-aviso">
                        Cancelamentos devem ser solicitados com pelo menos 24h de antecedência.
                      </p>
                    )
                  )}
                </div>
              </section>
            )
          })()}

          {/* ── Painel de Conformidade ── */}
          <section className="dash-section">
            <h3 className="section-title">Informações e Conformidade</h3>
            <div className="politicas-grid">
              {POLITICAS.map(p => (
                <button key={p.id} className="politica-card" onClick={() => setModalPolitica(p)}>
                  <span className="politica-icone">{p.icone}</span>
                  <span className="politica-titulo">{p.titulo}</span>
                  <span className="politica-seta">→</span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Histórico ── */}
          {historico.length > 0 && (
            <section className="dash-section">
              <h3 className="section-title">Histórico de Avaliações</h3>
              <div className="historico-list">
                {historico.map(c => (
                  <div key={c.id} className="historico-item">
                    <div>
                      <p className="historico-date">{formatDateShort(c.created_at)}</p>
                      <p className="historico-label">
                        {c.tipo === 'gratuita' ? 'Consulta Avaliativa' : 'Consulta Premium'} — concluída</p>
                    </div>
                    {c.analysis_summary && (
                      <button className="historico-ver" onClick={() => router.push(`/dashboard/leitura/${c.id}`)}>Ver →</button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Perfil ── */}
          <section className="dash-section">
            <h3 className="section-title">Meu Perfil</h3>
            <div className="perfil-card">
              <div className="perfil-info">
                <div className="perfil-avatar-lg">{userInitials}</div>
                <div className="perfil-info-text">
                  <p className="perfil-name">{userName}</p>
                  <p className="perfil-email">{userEmail}</p>
                </div>
              </div>
              <div className="perfil-actions">
                <button className="btn-outline" onClick={() => setModalPerfil(true)}>Editar</button>
              </div>
            </div>
          </section>
          {creditos.length > 0 && (
            <section className="dash-section">
              <h3 className="section-title">Meus Créditos</h3>
              <div className="creditos-list">
                {creditos.map(c => (
                  <div key={c.id} className="credito-item">
                    <div className="credito-item-header">
                      <span className="credito-item-valor">R$ {Number(c.amount).toFixed(2)}</span>
                      <span className={`credito-item-status credito-item-status--${c.status}`}>
                        {labelStatusCredito(c.status)}
                      </span>
                    </div>
                    <div className="credito-item-meta">
                      <span>
                        {c.origin === 'payment' ? '💳 Pagamento via PIX' : '↩️ Cancelamento'}
                        {' · '}
                        {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' })}
                      </span>
                      {c.used_at && (
                        <span>
                          Utilizado em {new Date(c.used_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' })}
                        </span>
                      )}
                    </div>
                    {c.status === 'available' && (
                      <button
                        className="credito-item-reembolso"
                        onClick={() => handleSolicitarReembolso(c.id)}
                        disabled={solicitandoReembolso === c.id}
                      >
                        {solicitandoReembolso === c.id ? 'Solicitando...' : 'Solicitar reembolso em dinheiro'}
                      </button>
                    )}
                  </div>
                ))}
                {reembolsoErro && <p className="modal-erro">{reembolsoErro}</p>}
              </div>
            </section>
          )}

        </main>

        <footer className="dash-footer">
          <p>ConsultaViva</p>
        </footer>

      </div>
    </>
  )
}

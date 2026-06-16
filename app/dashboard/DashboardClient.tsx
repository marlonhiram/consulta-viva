'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { VALOR_CONSULTA, VALOR_CONSULTA_FORMATADO } from '@/lib/constants'
import './dashboard.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Consultation = {
  id: string
  status: string
  tipo: string | null
  scheduled_at: string | null
  analysis_summary: string | null
  created_at: string
  photo_rejection_reason: string | null
  photo_rejection_count: number | null
}

type Credit = {
  id: string
  origin: string
  amount: number
  status: string
  created_at: string
  used_at: string | null
  used_for_consultation_id: string | null
}

type Props = {
  userName: string
  userInitials: string
  userEmail: string
  userFullName: string
  isPromocao: boolean
  consultation: Consultation | null
  historico: Consultation[]
  creditos: Credit[]
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function saudacao(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

function chatDisponivel(scheduled_at: string | null): boolean {
  if (!scheduled_at) return false
  const agora = Date.now()
  const horario = new Date(scheduled_at).getTime()
  return agora >= horario - 5 * 60 * 1000 && agora <= horario + 35 * 60 * 1000
}

function formatarCPF(valor: string) {
  return valor
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

// ─── Dados das Políticas ──────────────────────────────────────────────────────

type Politica = {
  id: string
  titulo: string
  icone: string
  conteudo: string
}

const POLITICAS: Politica[] = [
  {
    id: 'cancelamento',
    titulo: 'Política de Cancelamento',
    icone: '◎',
    conteudo: `Consultas agendadas podem ser canceladas pelo cliente com até 24 horas de antecedência em relação ao horário marcado. Cancelamentos realizados dentro deste prazo gerarão automaticamente um crédito no valor integral da consulta (R$ 100,00), disponível para uso em novo agendamento.

Cancelamentos solicitados com menos de 24 horas de antecedência não darão direito a crédito ou reembolso, exceto em casos de força maior devidamente comprovados, a critério exclusivo da especialista.

A especialista reserva o direito de cancelar ou reagendar consultas em casos de imprevistos, notificando o cliente com a maior antecedência possível. Nestes casos, o crédito será restituído integralmente.`,
  },
  {
    id: 'reembolso',
    titulo: 'Política de Reembolso',
    icone: '◈',
    conteudo: `O cliente pode solicitar o reembolso em dinheiro do crédito disponível a qualquer momento, desde que o crédito não tenha sido utilizado para agendamento.

Os reembolsos são processados manualmente em até 48 horas úteis após a solicitação, via transferência bancária ou PIX para os dados informados pelo cliente.

Ao solicitar o reembolso, o cliente receberá uma confirmação por e-mail com o protocolo da solicitação. Após a conclusão, um novo e-mail de confirmação será enviado.

Créditos originados de cancelamentos realizados pelo cliente com menos de 24 horas de antecedência não são elegíveis a reembolso em dinheiro.`,
  },
  {
    id: 'isencao',
    titulo: 'Isenção de Responsabilidade',
    icone: '✦',
    conteudo: `A consultoria especializada é uma prática de análise e orientação pessoal, de caráter reflexivo e interpretativo. As análises realizadas pela especialista não constituem diagnóstico médico, psicológico, jurídico, financeiro ou de qualquer outra natureza técnica ou científica.

As interpretações fornecidas têm finalidade orientativa e reflexiva, e não devem substituir a consulta a profissionais habilitados nas respectivas áreas.

A especialista não se responsabiliza por decisões tomadas pelo cliente com base nas análises realizadas. O cliente declara estar ciente do caráter orientativo e não prescritivo da prática ao contratar o serviço.`,
  },
  {
    id: 'natureza',
    titulo: 'Natureza do Serviço',
    icone: '◇',
    conteudo: `ConsultaViva é uma plataforma de consultoria especializada que conecta clientes com especialistas experientes. Com mais de 30 anos de experiência, nossa especialista realiza análises profundas sobre aspectos da personalidade, tendências de vida, relacionamentos e potenciais individuais.

As análises são realizadas de forma estritamente confidencial, sendo de uso exclusivo do cliente. O conteúdo não é compartilhado com terceiros sem autorização expressa do titular.

Cada análise é única e personalizada, baseada na interpretação individual do perfil do cliente.`,
  },
  {
    id: 'lgpd',
    titulo: 'Proteção de Dados (LGPD)',
    icone: '⊡',
    conteudo: `Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD), informamos:

Dados coletados: nome completo, e-mail, CPF, data de nascimento e materiais enviados para análise.

Finalidade: os dados são utilizados exclusivamente para a prestação do serviço de consultoria especializada e comunicação com o cliente.

Armazenamento: os dados são armazenados em servidores seguros e não são vendidos, cedidos ou compartilhados com terceiros para fins comerciais.

Retenção: os dados são mantidos pelo prazo necessário à prestação do serviço e por até 5 anos após o encerramento da relação, para fins de registro histórico e segurança jurídica.

Direitos do titular: o cliente pode solicitar a correção, exportação ou exclusão de seus dados a qualquer momento através dos canais de atendimento.`,
  },
  {
    id: 'termos',
    titulo: 'Termos de Uso',
    icone: '❖',
    conteudo: `Ao utilizar a plataforma ConsultaViva, o cliente concorda com os seguintes termos:

Elegibilidade: o serviço é destinado a maiores de 18 anos. O cadastro com dados falsos implica cancelamento imediato sem direito a reembolso.

Análise gratuita: cada CPF dá direito a uma única análise gratuita. Tentativas de burlar esta limitação resultarão em bloqueio da conta.

Conduta: o cliente deve tratar a especialista com respeito durante as consultas. Comportamentos abusivos resultarão no encerramento imediato da sessão sem reembolso.

Propriedade intelectual: as análises produzidas são de propriedade da especialista e do cliente, não podendo ser reproduzidas comercialmente sem autorização.

Modificações: estes termos podem ser atualizados a qualquer momento, com notificação prévia ao cliente cadastrado.`,
  },
]

// ─── Modal CPF ────────────────────────────────────────────────────────────────

function ModalCPF({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [cpf, setCpf] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setErro('')
    setLoading(true)
    try {
      const res = await fetch('/api/validate-cpf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao validar CPF.'); return }
      onSuccess()
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-eyebrow">Análise Gratuita</div>
        <h2 className="modal-title">Confirme seu CPF</h2>
        <p className="modal-desc">
          Para garantir que cada pessoa receba apenas uma análise gratuita,
          precisamos do seu CPF. Ele não será compartilhado.
        </p>
        <input
          className="dash-input"
          type="text"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={e => setCpf(formatarCPF(e.target.value))}
          inputMode="numeric"
          maxLength={14}
        />
        {erro && <p className="modal-erro">{erro}</p>}
        <button
          className="btn-primary btn-primary--lg"
          onClick={handleSubmit}
          disabled={loading || cpf.replace(/\D/g, '').length < 11}
        >
          {loading ? 'Validando...' : 'Confirmar e iniciar análise'}
        </button>
        <button className="modal-cancel" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── Modal Perfil ─────────────────────────────────────────────────────────────

function ModalPerfil({
  onClose,
  userFullName,
  userEmail,
}: {
  onClose: () => void
  userFullName: string
  userEmail: string
}) {
  const [aba, setAba] = useState<'perfil' | 'senha'>('perfil')
  const [nome, setNome] = useState(userFullName)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')
  const supabase = createClient()

  async function handleSalvarNome() {
    setErro(''); setSucesso('')
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error()
      const { error } = await supabase.from('profiles').update({ full_name: nome.trim() }).eq('id', user.id)
      if (error) throw error
      setSucesso('Nome atualizado com sucesso!')
      setTimeout(onClose, 1400)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAlterarSenha() {
    setErro(''); setSucesso('')
    if (novaSenha.length < 6) { setErro('A senha deve ter no mínimo 6 caracteres.'); return }
    if (novaSenha !== confirmaSenha) { setErro('As senhas não coincidem.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha })
      if (error) throw error
      setSucesso('Senha alterada com sucesso!')
      setNovaSenha(''); setConfirmaSenha('')
      setTimeout(onClose, 1400)
    } catch {
      setErro('Erro ao alterar senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-eyebrow">Minha Conta</div>
        <h2 className="modal-title">Editar Perfil</h2>
        <div className="modal-tabs">
          <button className={`modal-tab ${aba === 'perfil' ? 'active' : ''}`} onClick={() => { setAba('perfil'); setErro(''); setSucesso('') }}>Dados</button>
          <button className={`modal-tab ${aba === 'senha' ? 'active' : ''}`} onClick={() => { setAba('senha'); setErro(''); setSucesso('') }}>Senha</button>
        </div>
        {aba === 'perfil' && (
          <>
            <label className="dash-label">Nome completo</label>
            <input className="dash-input" type="text" value={nome} onChange={e => setNome(e.target.value)} />
            <label className="dash-label" style={{ marginTop: '12px' }}>E-mail</label>
            <input className="dash-input" type="email" value={userEmail} disabled />
            <p className="modal-desc" style={{ fontSize: '11px', marginTop: '2px' }}>Para alterar o e-mail, entre em contato com o suporte.</p>
            {erro && <p className="modal-erro">{erro}</p>}
            {sucesso && <p className="modal-sucesso">{sucesso}</p>}
            <button className="btn-primary btn-primary--lg" onClick={handleSalvarNome} disabled={loading || !nome.trim()}>
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </>
        )}
        {aba === 'senha' && (
          <>
            <label className="dash-label">Nova senha</label>
            <input className="dash-input" type="password" placeholder="Mínimo 6 caracteres" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
            <label className="dash-label" style={{ marginTop: '12px' }}>Confirmar nova senha</label>
            <input className="dash-input" type="password" placeholder="Repita a senha" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)} />
            {erro && <p className="modal-erro">{erro}</p>}
            {sucesso && <p className="modal-sucesso">{sucesso}</p>}
            <button className="btn-primary btn-primary--lg" onClick={handleAlterarSenha} disabled={loading || !novaSenha || !confirmaSenha} style={{ marginTop: '4px' }}>
              {loading ? 'Alterando...' : 'Alterar senha'}
            </button>
          </>
        )}
        <button className="modal-cancel" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── Modal PIX ────────────────────────────────────────────────────────────────

function ModalPix({
  consultationId,
  userEmail,
  userName,
  onClose,
  onPago,
}: {
  consultationId: string
  userEmail: string
  userName: string
  onClose: () => void
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
    } catch {
      setStep('erro')
    }
  }, [consultationId, userEmail, userName])

  useEffect(() => { gerarPix() }, [gerarPix])

  useEffect(() => {
    if (step !== 'qr') return
    const channel = supabase
      .channel(`payment-${consultationId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payments', filter: `consultation_id=eq.${consultationId}` },
        (payload) => { if (payload.new.status === 'paid') { setStep('confirmado'); setTimeout(() => onPago(), 2000) } }
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [step, consultationId, supabase, onPago])

  async function copiarPix() {
    try { await navigator.clipboard.writeText(pixCopiaECola); setCopiado(true); setTimeout(() => setCopiado(false), 3000) } catch {}
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--pix" onClick={e => e.stopPropagation()}>
        {step === 'loading' && (
          <>
            <div className="modal-eyebrow">Consulta Premium</div>
            <h2 className="modal-title">Gerando seu PIX...</h2>
            <div className="pix-loading"><div className="pix-spinner" /><p className="pix-loading-text">Conectando ao Mercado Pago</p></div>
          </>
        )}
        {step === 'qr' && (
          <>
            <div className="modal-eyebrow">Consulta Premium · {VALOR_CONSULTA_FORMATADO}</div>
            <h2 className="modal-title">Pague via PIX</h2>
            <p className="modal-desc">Escaneie o QR Code abaixo ou copie o código PIX. Após o pagamento, sua consulta será liberada automaticamente.</p>
            {qrCodeBase64 && <div className="pix-qr-wrap"><img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR Code PIX" className="pix-qr-img" /></div>}
            <button className="pix-copiar-btn" onClick={copiarPix}>{copiado ? '✓ Código copiado!' : 'Copiar código PIX'}</button>
            <div className="pix-info"><span className="pix-info-dot" />Aguardando confirmação do pagamento...</div>
            <p className="pix-validade">O PIX expira em 30 minutos · Pagamento processado pelo Mercado Pago</p>
          </>
        )}
        {step === 'confirmado' && (
          <>
            <div className="pix-sucesso-icon">✦</div>
            <div className="modal-eyebrow">Pagamento confirmado</div>
            <h2 className="modal-title">Crédito disponível!</h2>
            <p className="modal-desc">Seu pagamento foi confirmado. Agora você pode agendar sua consulta no melhor horário para você.</p>
          </>
        )}
        {step === 'erro' && (
          <>
            <div className="modal-eyebrow">Erro</div>
            <h2 className="modal-title">Não foi possível gerar o PIX</h2>
            <p className="modal-desc">Ocorreu um erro ao conectar com o Mercado Pago. Tente novamente.</p>
            <button className="btn-primary btn-primary--lg" onClick={gerarPix}>Tentar novamente</button>
          </>
        )}
        <button className="modal-cancel" onClick={onClose}>{step === 'confirmado' ? 'Fechar' : 'Cancelar'}</button>
      </div>
    </div>
  )
}

// ─── Modal Política ───────────────────────────────────────────────────────────

function ModalPolitica({ politica, onClose }: { politica: Politica; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--politica" onClick={e => e.stopPropagation()}>
        <div className="modal-politica-header">
          <span className="modal-politica-icone">{politica.icone}</span>
          <div className="modal-eyebrow">Informações</div>
        </div>
        <h2 className="modal-title">{politica.titulo}</h2>
        <div className="modal-politica-conteudo">
          {politica.conteudo.split('\n\n').map((paragrafo, i) => (
            <p key={i} className="modal-politica-paragrafo">{paragrafo}</p>
          ))}
        </div>
        <button className="modal-cancel" onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}

// ─── Modal Cancelar Consulta ──────────────────────────────────────────────────

function ModalCancelarConsulta({
  consultationId,
  onClose,
  onCancelado,
}: {
  consultationId: string
  onClose: () => void
  onCancelado: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleCancelar() {
    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/cancelar-consulta-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationId }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao cancelar.'); return }
      onCancelado()
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-eyebrow">Cancelamento</div>
        <h2 className="modal-title">Cancelar consulta?</h2>
        <p className="modal-desc">
          Ao cancelar, um crédito de <strong>R$ 100,00</strong> será gerado automaticamente
          e ficará disponível para novo agendamento. Você também pode solicitar
          reembolso em dinheiro após o cancelamento.
        </p>
        {erro && <p className="modal-erro">{erro}</p>}
        <button className="btn-primary btn-primary--lg btn-primary--danger" onClick={handleCancelar} disabled={loading}>
          {loading ? 'Cancelando...' : 'Confirmar cancelamento'}
        </button>
        <button className="modal-cancel" onClick={onClose}>Voltar</button>
      </div>
    </div>
  )
}

// ─── Logout ───────────────────────────────────────────────────────────────────

function LogoutBtn() {
  const supabase = createClient()
  const router = useRouter()
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }
  return <button className="logout-btn" onClick={handleLogout}>Sair</button>
}

function labelStatusCredito(status: string): string {
  switch (status) {
    case 'available': return '🟢 Disponível'
    case 'used': return '✅ Utilizado'
    case 'refund_requested': return '🔄 Reembolso solicitado'
    case 'refunded': return '💰 Reembolsado'
    default: return status
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardClient({
  userName,
  userInitials,
  userEmail,
  userFullName,
  isPromocao,
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
                <h2 className="status-heading">Sua análise está em andamento</h2>
                <p className="status-body">Recebemos suas informações e materiais. Nossa especialista está preparando sua análise com atenção. O prazo é de até <strong>48 horas</strong>.</p>
                <div className="status-progress">
                  <div className="status-progress-step done"><span className="step-dot-sm">✓</span><span>Triagem concluída</span></div>
                  <div className="status-progress-line" />
                  <div className="status-progress-step active"><span className="step-dot-sm pulse">◉</span><span>Em análise</span></div>
                  <div className="status-progress-line muted" />
                  <div className="status-progress-step"><span className="step-dot-sm muted">◎</span><span className="muted">Análise pronta</span></div>
                </div>
                <div className="status-badge"><span className="badge-dot" /> Aguardando análise</div>
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
                    <li>✋ Posição estável e sem tremores</li>
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
                <p className="status-eyebrow">Análise Concluída</p>
                <h2 className="status-heading">Sua análise está pronta</h2>

                {previewAnalise ? (
                  <div className="analysis-preview">
                    <p className="analysis-preview-text">{previewAnalise}</p>
                    <div className="analysis-fade" />
                  </div>
                ) : (
                  <p className="status-body">A análise será exibida em breve.</p>
                )}

                <button className="btn-primary" onClick={() => router.push(`/dashboard/leitura/${consultation?.id}`)}>
                  Ler minha análise completa →
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
              <h3 className="section-title">Histórico de Análises</h3>
              <div className="historico-list">
                {historico.map(c => (
                  <div key={c.id} className="historico-item">
                    <div>
                      <p className="historico-date">{formatDateShort(c.created_at)}</p>
                      <p className="historico-label">
                        {c.tipo === 'gratuita' ? 'Análise gratuita' : 'Consulta premium'} — concluída </p>
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
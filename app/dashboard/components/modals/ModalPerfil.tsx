'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

/* ─── Modal Perfil ──────────────────────────────────────────────────────── */

export function ModalPerfil({
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

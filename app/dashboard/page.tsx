export const dynamic = 'force-dynamic';
export const revalidade = 0;
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getInitials } from '@/lib/utils'
import DashboardClient from './DashboardClient'
import './dashboard.css'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, birth_date, hand_dominance, cpf')
    .eq('id', user.id)
    .single()

  // Consulta mais recente (qualquer status)
  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status, tipo, scheduled_at, analysis_summary, created_at, photo_rejection_reason, photo_rejection_count')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Histórico: todas as consultas concluídas
  const { data: historico } = await supabase
    .from('consultations')
    .select('id, status, tipo, scheduled_at, analysis_summary, created_at, photo_rejection_reason, photo_rejection_count')
    .eq('user_id', user.id)
    .eq('status', 'concluida')
    .order('created_at', { ascending: false })

  // Detecta promoção ativa
  const { data: promocao } = await supabase
    .from('promocoes')
    .select('id, limite, usadas')
    .eq('ativa', true)
    .eq('tipo', 'leitura_gratuita')
    .gte('expira_em', new Date().toISOString())
    .maybeSingle()

  const isPromocao = !!promocao && promocao.usadas < promocao.limite

  const { data: creditos } = await supabase
    .from('credits')
    .select('id, origin, amount, status, created_at, used_at, used_for_consultation_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  const name = profile?.full_name ?? 'Cliente'
  const initials = getInitials(name)

    return (
      <DashboardClient
        userName={name}
        userInitials={initials}
        userEmail={profile?.email ?? user.email ?? ''}
        userFullName={profile?.full_name ?? ''}
        isPromocao={isPromocao}
        consultation={consultation ?? null}
        historico={historico ?? []}
        creditos={creditos ?? []}
      />
    )
}

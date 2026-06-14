export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ChatClient from './ChatClient'
import './chat.css'

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Verificar role
  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isAdmin = role?.role === 'admin'

  // Buscar consulta
  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status, scheduled_at, ended_at, user_id, analysis_summary')
    .eq('id', id)
    .single()

  if (!consultation) redirect('/dashboard')

  // Cliente só pode acessar sua própria consulta
  if (!isAdmin && consultation.user_id !== user.id) redirect('/dashboard')

  // Consulta precisa estar agendada ou em andamento
  if (!['agendada', 'em_andamento'].includes(consultation.status)) {
    redirect(isAdmin ? '/admin' : '/dashboard')
  }

  // Verificar janela de acesso (5min antes até 35min depois)
  const agora = Date.now()
  const horario = new Date(consultation.scheduled_at).getTime()
  const dentroJanela = agora >= horario - 5 * 60 * 1000 && agora <= horario + 35 * 60 * 1000

  if (!dentroJanela) {
    redirect(isAdmin ? '/admin' : '/dashboard')
  }

  // Buscar dados do cliente para exibir no chat
  const { data: clientProfile } = await supabase
    .from('profiles')
    .select('full_name, birth_date, hand_dominance')
    .eq('id', consultation.user_id)
    .single()

  // Buscar mensagens existentes (triagem + chat)
  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender_id, content, is_ai, message_type, created_at')
    .eq('consultation_id', id)
    .order('created_at', { ascending: true })

  // Buscar fotos
  const { data: photos } = await supabase
    .from('photos')
    .select('id, storage_url, hand_type')
    .eq('consultation_id', id)
    .eq('status', 'approved')

  return (
    <ChatClient
      consultationId={id}
      scheduledAt={consultation.scheduled_at}
      isAdmin={isAdmin}
      userId={user.id}
      clientName={clientProfile?.full_name ?? 'Cliente'}
      clientBirthDate={clientProfile?.birth_date ?? null}
      clientHandDominance={clientProfile?.hand_dominance ?? null}
      analysisSummary={consultation.analysis_summary ?? null}
      initialMessages={messages ?? []}
      photos={photos ?? []}
    />
  )
}

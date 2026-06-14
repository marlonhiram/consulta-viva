export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AgendarClient from './AgendarClient'
import './agendar.css'

export default async function AgendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Verificar que a consulta pertence ao usuário e está concluída
  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status, scheduled_at')
    .eq('id', id)          // ← era params.id
    .eq('user_id', user.id)
    .single()

  if (!consultation || consultation.status !== 'concluida') {
    redirect('/dashboard')
  }

  const { data: credito } = await supabase
    .from('credits')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'available')
    .limit(1)
    .single()

  if (!credito) redirect('/dashboard')

  return <AgendarClient consultationId={id} /> 
}

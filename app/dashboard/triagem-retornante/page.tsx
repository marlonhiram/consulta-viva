export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TriagemRetornanteClient from './TriagemRetornanteClient'

export default async function TriagemRetornantePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Só retornantes com premium concluída chegam aqui
  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status, tipo')
    .eq('user_id', user.id)
    .eq('tipo', 'premium')
    .eq('status', 'concluida')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!consultation) redirect('/dashboard')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, hand_dominance')
    .eq('id', user.id)
    .single()

  return (
    <TriagemRetornanteClient
      userId={user.id}
      userEmail={profile?.email ?? ''}
      userName={profile?.full_name ?? ''}
      handDominance={profile?.hand_dominance ?? 'destro'}
    />
  )
}
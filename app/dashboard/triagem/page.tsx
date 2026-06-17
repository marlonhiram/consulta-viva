import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TriagemClient from './TriagemClient'

export const metadata = { title: 'Triagem - ConsultaViva' }

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function TriagemPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/cadastro')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'você'

  const { data: todasConsultas } = await supabase
    .from('consultations')
    .select('id, status, tipo')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const existing = todasConsultas?.[0] ?? null
  const emTriagem = todasConsultas?.find(c => c.status === 'triagem') ?? null

  if (existing && existing.status !== 'triagem' && !emTriagem) {
    redirect('/dashboard')
  }

  let consultationId = emTriagem?.id

  if (!consultationId) {
    const { data: nova } = await supabase
      .from('consultations')
      .insert({
        user_id: user.id,
        status: 'triagem',
        tipo: 'gratuita',
      })
      .select('id')
      .single()

    consultationId = nova?.id
  }

  if (!consultationId) redirect('/dashboard')

  return (
    <TriagemClient
      consultationId={consultationId}
      userId={user.id}
      firstName={firstName}
    />
  )
}

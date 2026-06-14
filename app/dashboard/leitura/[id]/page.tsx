import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import LeituraClient from './LeituraClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return { title: 'Minha Leitura — Quiros' }
}

export default async function LeituraPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/cadastro')

  const id = (await params).id

  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, analysis_summary, created_at, user_id, tipo')
    .eq('id', id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const { data: creditos } = await supabase
    .from('credits')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('status', 'available')

  const creditoDisponivel = (creditos?.length ?? 0) > 0

      // Segurança: só o dono da consulta pode ver
      if (!consultation || consultation.user_id !== user.id) {
      redirect('/dashboard')
     }

  if (!consultation.analysis_summary) {
    redirect('/dashboard')
  }

  return (
    <LeituraClient
      analysis={consultation.analysis_summary}
      createdAt={consultation.created_at}
      consultationId={consultation.id}
      userEmail={profile?.email ?? ''}
      userName={profile?.full_name ?? ''}
      creditoDisponivel={creditoDisponivel}
      tipo={consultation.tipo}
    />
  )
}

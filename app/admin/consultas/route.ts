import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data: solics } = await supabaseAdmin
    .from('consultations')
    .select(`
      id, status, created_at,
      profiles(full_name, email, birth_date, hand_dominance),
      photos(id, storage_url, hand_type),
      messages(content, is_ai)
    `)
        .in('status', ['aguardando_analise', 'fotos_recusadas'])
    .order('created_at', { ascending: true })

  const { data: reals } = await supabaseAdmin
    .from('consultations')
    .select(`
      id, status, created_at,
      profiles(full_name, email, birth_date, hand_dominance)
    `)
    .eq('status', 'concluida')
    .order('created_at', { ascending: false })

  return NextResponse.json({ solics: solics ?? [], reals: reals ?? [] })
}
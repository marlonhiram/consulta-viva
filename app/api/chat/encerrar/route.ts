import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { consultationId } = await req.json()
  if (!consultationId) return NextResponse.json({ error: 'consultationId obrigatório.' }, { status: 400 })

  const { data: role } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (role?.role !== 'admin') return NextResponse.json({ error: 'Apenas a especialista pode encerrar.' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('consultations')
    .update({
      status: 'concluida',
      ended_at: new Date().toISOString(),
    })
    .eq('id', consultationId)
    .in('status', ['agendada', 'em_andamento'])

  if (error) return NextResponse.json({ error: 'Erro ao encerrar consulta.' }, { status: 500 })

  return NextResponse.json({ success: true })
}

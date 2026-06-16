import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { consultationIdOnlySchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const parsed = consultationIdOnlySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
  }
  const { consultationId } = parsed.data

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

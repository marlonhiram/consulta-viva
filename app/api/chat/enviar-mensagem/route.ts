import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const { consultationId, content, messageType } = await req.json()
    if (!consultationId || !content?.trim()) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    const { data: consultation } = await supabaseAdmin
      .from('consultations')
      .select('id, status, scheduled_at, user_id')
      .eq('id', consultationId)
      .single()

    if (!consultation) return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })

    if (!['agendada', 'em_andamento'].includes(consultation.status)) {
      return NextResponse.json({ error: 'Consulta não está ativa.' }, { status: 400 })
    }

    // Verificar se é admin ou cliente da consulta
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin = roleData?.role === 'admin'
    const isCliente = consultation.user_id === user.id

    if (!isAdmin && !isCliente) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    // Primeira mensagem → status vira em_andamento
    if (consultation.status === 'agendada') {
      await supabaseAdmin
        .from('consultations')
        .update({ status: 'em_andamento' })
        .eq('id', consultationId)
    }

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({
        consultation_id: consultationId,
        sender_id: user.id,
        content: content.trim(),
        is_ai: false,
        message_type: messageType === 'image' ? 'image' : 'text',
      })
      .select()
      .single()

    if (error) {
      console.error('Erro insert message:', JSON.stringify(error))
      return NextResponse.json({ error: 'Erro ao enviar mensagem.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message })
  } catch (err) {
    console.error('Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enviarMensagemSchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const parsed = enviarMensagemSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
    }
    const { consultationId, content, messageType } = parsed.data

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
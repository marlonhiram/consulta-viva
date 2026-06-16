import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail, SITE_URL } from '@/lib/email'
import { EmailConsultaAgendada } from '@/emails/consulta-agendada'
import { agendarConsultaSchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  // Verificar autenticação
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const parsed = agendarConsultaSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
  }
  const { consultationId, startsAt } = parsed.data

  // Verificar que a consulta pertence ao usuário e está com crédito disponível
  const { data: consultation, error: consultError } = await supabaseAdmin
    .from('consultations')
    .select('id, user_id, status')
    .eq('id', consultationId)
    .eq('user_id', user.id)
    .single()

  if (consultError || !consultation) {
    return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })
  }

  if (consultation.status !== 'concluida') {
    return NextResponse.json({ error: 'Consulta não está elegível para agendamento.' }, { status: 400 })
  }

  // Verificar crédito disponível
  const { data: credito } = await supabaseAdmin
    .from('credits')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'available')
    .limit(1)
    .single()

  if (!credito) {
    return NextResponse.json({ error: 'Nenhum crédito disponível para agendamento.' }, { status: 400 })
  }

  // Verificar conflito de horário (anti-race condition)
  const slotStart = new Date(startsAt)
  const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000) // 30min

  const { data: conflito } = await supabaseAdmin
    .from('consultations')
    .select('id')
    .eq('status', 'agendada')
    .neq('id', consultationId)
    .lte('scheduled_at', slotEnd.toISOString())
    .gte('scheduled_at', new Date(slotStart.getTime() - 29 * 60 * 1000).toISOString())
    .limit(1)
    .single()

  if (conflito) {
    return NextResponse.json(
      { error: 'Este horário acabou de ser ocupado. Por favor, escolha outro.' },
      { status: 409 }
    )
  }

  const { data: conflitoBlock } = await supabaseAdmin
    .from('agenda_blocks')
    .select('id')
    .lte('starts_at', slotEnd.toISOString())
    .gte('ends_at', slotStart.toISOString())
    .limit(1)
    .single()

  if (conflitoBlock) {
    return NextResponse.json(
      { error: 'Este horário não está mais disponível. Por favor, escolha outro.' },
      { status: 409 }
    )
  }

  // Buscar config para duração do slot
  const { data: agendaConfig } = await supabaseAdmin
    .from('agenda_config')
    .select('slot_duration_minutes')
    .single()

  const slotDuration = agendaConfig?.slot_duration_minutes ?? 30

  // Tudo OK — executar em sequência atômica
  // 1. Criar agenda_block
  const { error: blockError } = await supabaseAdmin
    .from('agenda_blocks')
    .insert({
      starts_at: slotStart.toISOString(),
      ends_at: slotEnd.toISOString(),
      reason: 'Consulta Premium agendada pelo cliente',
      type: 'presencial',
    })

  if (blockError) {
    console.error('Erro ao criar agenda_block:', blockError)
    return NextResponse.json({ error: 'Erro ao reservar horário.' }, { status: 500 })
  }

  // 2. Atualizar consulta
  const { error: consultUpdateError } = await supabaseAdmin
    .from('consultations')
    .update({
      scheduled_at: slotStart.toISOString(),
      status: 'agendada',
    })
    .eq('id', consultationId)

  if (consultUpdateError) {
    console.error('Erro ao atualizar consulta:', consultUpdateError)
    return NextResponse.json({ error: 'Erro ao confirmar agendamento.' }, { status: 500 })
  }

  // 3. Marcar crédito como usado
  const { error: creditError } = await supabaseAdmin
    .from('credits')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
      used_for_consultation_id: consultationId,
    })
    .eq('id', credito.id)

  if (creditError) console.error('Erro ao marcar crédito como usado:', creditError)

  // Buscar perfil do cliente para e-mail
  const { data: perfil } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  if (perfil) {
    const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
    }).format(slotStart)

    const firstName = perfil.full_name?.split(' ')[0] ?? 'cliente'

    await sendEmail({
      to: perfil.email,
      subject: `Consulta confirmada! ✅`,
      template: <EmailConsultaAgendada nome={firstName} dataHora={dataFormatada} siteUrl={SITE_URL} consultationId={consultationId} />,
    })

    await sendEmail({
      to: process.env.ESPECIALISTA_EMAIL!,
      subject: `Nova consulta agendada — ${perfil.full_name}`,
      template: <EmailConsultaAgendada nome="Especialista" dataHora={dataFormatada} siteUrl={SITE_URL} consultationId={consultationId} isEspecialista nomeCliente={perfil.full_name} />,
    })
  }

  return NextResponse.json({ success: true, scheduled_at: slotStart.toISOString() })

  
}

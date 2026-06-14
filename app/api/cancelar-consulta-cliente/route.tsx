import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { EmailCancelamentoCliente } from '@/emails/cancelamento-cliente'

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

  // Buscar consulta
  const { data: consultation } = await supabaseAdmin
    .from('consultations')
    .select('id, user_id, status, scheduled_at')
    .eq('id', consultationId)
    .eq('user_id', user.id)
    .single()

  if (!consultation) return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })
  if (consultation.status !== 'agendada') return NextResponse.json({ error: 'Consulta não está agendada.' }, { status: 400 })

  // Verificar regra das 24h
  const agora = Date.now()
  const horario = new Date(consultation.scheduled_at).getTime()
  const diferencaMs = horario - agora
  const horasRestantes = diferencaMs / (1000 * 60 * 60)

  if (horasRestantes < 24) {
    return NextResponse.json(
      { error: 'Cancelamentos devem ser solicitados com pelo menos 24h de antecedência.' },
      { status: 403 }
    )
  }

  // Cancelar consulta
  const { error: cancelError } = await supabaseAdmin
    .from('consultations')
    .update({
      status: 'cancelada',
      cancelled_at: new Date().toISOString(),
      cancelled_by: 'client',
      cancellation_reason: 'Cancelado pelo cliente',
    })
    .eq('id', consultationId)

  if (cancelError) return NextResponse.json({ error: 'Erro ao cancelar consulta.' }, { status: 500 })

  // Remover agenda_block correspondente
  await supabaseAdmin
    .from('agenda_blocks')
    .delete()
    .eq('starts_at', consultation.scheduled_at)

  // Gerar crédito de reembolso
  const { error: creditError } = await supabaseAdmin
    .from('credits')
    .insert({
      user_id: user.id,
      consultation_id: consultationId,
      origin: 'cancellation_refund',
      amount: 100.00,
      status: 'available',
    })

  if (creditError) console.error('Erro ao gerar crédito de cancelamento:', creditError)

  // Buscar perfil do cliente para e-mail
  const { data: perfil } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  if (perfil) {
    const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
    }).format(new Date(consultation.scheduled_at))

    await sendEmail({
      to: process.env.ESPECIALISTA_EMAIL!,
      subject: `Consulta cancelada — ${perfil.full_name}`,
      template: <EmailCancelamentoCliente nomeEspecialista="Especialista" nomeCliente={perfil.full_name} dataHora={dataFormatada} />,
    })
  }

  return NextResponse.json({ success: true })
}

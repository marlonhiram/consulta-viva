import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, SITE_URL } from '@/lib/email'
import { EmailCancelamentoEspecialista } from '@/emails/cancelamento-especialista'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { consultationId, reason } = await req.json()

    if (!consultationId || !reason || reason.trim().length < 10) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    // Busca a consulta
    const { data: consultation, error: fetchError } = await supabase
      .from('consultations')
      .select('id, user_id, status')
      .eq('id', consultationId)
      .single()

    if (fetchError || !consultation) {
      return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })
    }

    if (consultation.status === 'cancelada') {
      return NextResponse.json({ error: 'Consulta já cancelada.' }, { status: 400 })
    }

    // Cancela a consulta
    const { error: updateError } = await supabase
      .from('consultations')
      .update({
        status: 'cancelada',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason.trim(),
        cancelled_by: 'admin',
      })
      .eq('id', consultationId)

    if (updateError) throw updateError

    // Gera crédito para o cliente
    const { error: creditError } = await supabase
      .from('credits')
      .insert({
        user_id: consultation.user_id,
        consultation_id: consultationId,
        origin: 'cancellation_refund',
        amount: 100.00,
        status: 'available',
      })

if (creditError) throw creditError

    // Buscar perfil do cliente para e-mail
    const { data: perfil } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', consultation.user_id)
      .single()

    if (perfil) {
      const firstName = perfil.full_name?.split(' ')[0] ?? 'cliente'
      await sendEmail({
        to: perfil.email,
        subject: 'Sua consulta foi cancelada',
        template: <EmailCancelamentoEspecialista nome={firstName} dataHora="—" motivo={reason.trim()} siteUrl={SITE_URL} />,
      })
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[cancelar-consulta]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
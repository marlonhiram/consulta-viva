import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { VALOR_CONSULTA } from '@/lib/constants'

export async function POST(req: NextRequest) {
  try {
    // Verificação por token de URL — só o MP conhece a URL completa com o token
    const token = new URL(req.url).searchParams.get('token')
    if (!token || token !== process.env.WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const body = await req.json()

    // Anti-replay: rejeitar notificações com mais de 15 minutos
    if (body.date_created) {
      const eventAge = Date.now() - new Date(body.date_created).getTime()
      if (eventAge > 15 * 60 * 1000) {
        console.warn('[webhook-mp] Notificação antiga ignorada — age:', Math.round(eventAge / 1000), 's')
        return NextResponse.json({ ok: true })
      }
    }

    if (body.type !== 'payment') {
      return NextResponse.json({ ok: true })
    }

    const paymentId = String(body.data?.id ?? '')
    if (!paymentId) return NextResponse.json({ ok: true })

    // Re-busca o pagamento na API do MP para confirmar o status real
    // Isso é a verificação de segurança primária: nunca confiamos no body do webhook
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      console.error('[webhook-mp] Erro ao buscar pagamento:', mpData)
      return NextResponse.json({ ok: true })
    }

    const consultationId = mpData.metadata?.consultation_id
    const status = mpData.status

    if (!consultationId) {
      console.error('[webhook-mp] consultation_id não encontrado no metadata')
      return NextResponse.json({ ok: true })
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('gateway_id', String(paymentId))
      .single()

    if (!payment) {
      console.error('[webhook-mp] Pagamento não encontrado no banco:', paymentId)
      return NextResponse.json({ ok: true })
    }

    const novoStatus = status === 'approved' ? 'paid' : status === 'rejected' ? 'failed' : 'pending'

    await supabase
      .from('payments')
      .update({
        status: novoStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)

    if (status === 'approved' && payment.status !== 'paid') {
      const { data: consultation } = await supabase
        .from('consultations')
        .select('user_id')
        .eq('id', consultationId)
        .single()

      if (consultation) {
        const { data: creditExisting } = await supabase
          .from('credits')
          .select('id')
          .eq('consultation_id', consultationId)
          .eq('origin', 'payment')
          .single()

        if (!creditExisting) {
          await supabase
            .from('credits')
            .insert({
              user_id: consultation.user_id,
              consultation_id: consultationId,
              origin: 'payment',
              amount: VALOR_CONSULTA,
              status: 'available',
            })
        }
      }
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[webhook-mp]', err)
    return NextResponse.json({ ok: true })
  }
}

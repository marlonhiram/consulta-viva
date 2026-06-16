import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { VALOR_CONSULTA } from '@/lib/constants'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // MP envia type=payment quando um pagamento é atualizado
    if (body.type !== 'payment') {
      return NextResponse.json({ ok: true })
    }

    const paymentId = String(body.data?.id)
    if (!paymentId) return NextResponse.json({ ok: true })

    // Busca o pagamento no MP para confirmar o status
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      console.error('[webhook-mp] Erro ao buscar pagamento:', mpData)
      return NextResponse.json({ ok: true })
    }

    const consultationId = mpData.metadata?.consultation_id
    const status = mpData.status // approved, pending, rejected, etc

    if (!consultationId) {
      console.error('[webhook-mp] consultation_id não encontrado no metadata')
      return NextResponse.json({ ok: true })
    }

    // Atualiza o pagamento no banco
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

    // Se aprovado: gera crédito para o cliente
    if (status === 'approved' && payment.status !== 'paid') {
      // Busca user_id da consulta
      const { data: consultation } = await supabase
        .from('consultations')
        .select('user_id')
        .eq('id', consultationId)
        .single()

      if (consultation) {
        // Verifica se já existe crédito para evitar duplicata
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
    return NextResponse.json({ ok: true }) // sempre 200 para o MP não retentar
  }
}
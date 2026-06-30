import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { VALOR_CONSULTA } from '@/lib/constants'

/**
 * Verifica a assinatura HMAC-SHA256 do webhook do Mercado Pago.
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *
 * Template assinado: id:<paymentId>;request-id:<xRequestId>;ts:<ts>
 */
function verificarAssinaturaMP(
  paymentId: string,
  xSignature: string | null,
  xRequestId: string | null,
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook-mp] MP_WEBHOOK_SECRET não configurado.')
    return false
  }

  if (!xSignature || !xRequestId) return false

  // Extrai ts e v1 do header x-signature: "ts=TIMESTAMP,v1=HASH"
  const parts = Object.fromEntries(
    xSignature.split(',').map(p => p.split('=') as [string, string])
  )
  const ts = parts['ts']
  const v1 = parts['v1']

  if (!ts || !v1) return false

  const template = `id:${paymentId};request-id:${xRequestId};ts:${ts}`
  const hash = createHmac('sha256', secret).update(template).digest('hex')

  return hash === v1
}

export async function POST(req: NextRequest) {
  try {
    const xSignature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')

    const body = await req.json()

    if (body.type !== 'payment') {
      return NextResponse.json({ ok: true })
    }

    const paymentId = String(body.data?.id ?? '')
    if (!paymentId) return NextResponse.json({ ok: true })

    if (!verificarAssinaturaMP(paymentId, xSignature, xRequestId)) {
      console.error('[webhook-mp] Assinatura inválida — requisição rejeitada.')
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
    }

    // Re-busca o pagamento na API do MP para confirmar o status real
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

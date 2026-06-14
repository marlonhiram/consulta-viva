import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { consultationId, userEmail, userName } = await req.json()

    if (!consultationId || !userEmail || !userName) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    // Verifica se já existe pagamento pendente ou pago
    const { data: existing } = await supabase
      .from('payments')
      .select('id, status')
      .eq('consultation_id', consultationId)
      .in('status', ['pending', 'paid'])
      .single()

    if (existing?.status === 'paid') {
      return NextResponse.json({ error: 'Consulta já paga.' }, { status: 409 })
    }

    // Cria o pagamento PIX no Mercado Pago

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'X-Idempotency-Key': consultationId,
      },
      body: JSON.stringify({
        transaction_amount: 197,
        description: 'Consulta Premium de Quiromancia — Quiros',
        payment_method_id: 'pix',
        payer: {
          email: userEmail,
          first_name: userName.split(' ')[0],
          last_name: userName.split(' ').slice(1).join(' ') || '-',
        },
        notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/mercadopago`,
        metadata: {
          consultation_id: consultationId,
        },
      }),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      console.error('[criar-pix] MP error:', mpData)
      return NextResponse.json({ error: 'Erro ao gerar PIX.' }, { status: 500 })
    }

    const pixInfo = mpData.point_of_interaction?.transaction_data
    const gatewayId = String(mpData.id)

    // Salva ou atualiza o pagamento no banco
    if (existing) {
      await supabase
        .from('payments')
        .update({
          gateway_id: gatewayId,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('payments')
        .insert({
          consultation_id: consultationId,
          gateway_id: gatewayId,
          amount: 100.00,
          status: 'pending',
        })
    }

    return NextResponse.json({
      ok: true,
      pixCopiaECola: pixInfo?.qr_code,
      qrCodeBase64: pixInfo?.qr_code_base64,
      gatewayId,
    })

  } catch (err) {
    console.error('[criar-pix]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { VALOR_CONSULTA } from '@/lib/constants'
import { criarPixSchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const parsed = criarPixSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
    }
    const { consultationId } = parsed.data

    // Dados do pagador vêm sempre do perfil autenticado, nunca do body
    const { data: perfil } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()
    if (!perfil) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })
    const userEmail = perfil.email
    const userName = perfil.full_name ?? '-'

    // Garante que a consulta pertence ao usuário autenticado
    const { data: consultation } = await supabase
      .from('consultations')
      .select('id')
      .eq('id', consultationId)
      .eq('user_id', user.id)
      .single()

    if (!consultation) {
      return NextResponse.json({ error: 'Consulta não encontrada.' }, { status: 404 })
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
        transaction_amount: VALOR_CONSULTA,
        description: 'Consulta Premium — ConsultaViva',
        payment_method_id: 'pix',
        payer: {
          email: userEmail,
          first_name: userName.split(' ')[0],
          last_name: userName.split(' ').slice(1).join(' ') || '-',
        },
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
          amount: VALOR_CONSULTA,
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
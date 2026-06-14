import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail, SITE_URL } from '@/lib/email'
import { EmailBoasVindas } from '@/emails/boas-vindas'

export async function POST(req: NextRequest) {
  try {
    const { user_id, phone, hand_dominance, promo_id } = await req.json()

    if (!user_id || !phone || !hand_dominance || !promo_id) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    /* gera cancel_token único */
    const cancel_token = crypto.randomUUID()

    /* atualiza perfil com campos extras */
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ phone, hand_dominance, cancel_token })
      .eq('id', user_id)
      .select('full_name, email')
      .single()

    if (profileError || !profile) {
      console.error('Erro ao atualizar perfil:', profileError)
      return NextResponse.json({ error: 'Erro ao salvar perfil.' }, { status: 500 })
    }

    /* incrementa vagas usadas na promoção */
    const { error: promoError } = await supabaseAdmin.rpc('incrementar_usadas', { promo_id })
    if (promoError) {
      console.error('Erro ao incrementar usadas:', promoError)
    }

    /* envia e-mail de boas-vindas com cancel_token */
    await sendEmail({
      to: profile.email,
      subject: 'Bem-vindo(a) à ConsultaViva 🌿',
      template: (
        <EmailBoasVindas
          nome={profile.full_name}
          siteUrl={SITE_URL}
          cancelToken={cancel_token}
        />
      ),
    })

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('Erro em /api/promo/perfil:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
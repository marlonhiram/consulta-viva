import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail, SITE_URL } from '@/lib/email'
import { EmailBoasVindas } from '@/emails/boas-vindas'
import { z } from 'zod'

const promoPerfilSchema = z.object({
  phone: z.string().min(8).max(20),
  hand_dominance: z.enum(['destro', 'canhoto']),
  promo_id: z.string().uuid('promo_id inválido'),
})

export async function POST(req: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const parsed = promoPerfilSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
    }

    const { phone, hand_dominance, promo_id } = parsed.data

    const cancel_token = crypto.randomUUID()

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ phone, hand_dominance, cancel_token })
      .eq('id', user.id)
      .select('full_name, email')
      .single()

    if (profileError || !profile) {
      console.error('Erro ao atualizar perfil:', profileError)
      return NextResponse.json({ error: 'Erro ao salvar perfil.' }, { status: 500 })
    }

    const { error: promoError } = await supabaseAdmin.rpc('incrementar_usadas', { promo_id })
    if (promoError) {
      console.error('Erro ao incrementar usadas:', promoError)
    }

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

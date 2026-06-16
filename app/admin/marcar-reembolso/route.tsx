import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/email'
import { EmailReembolsoConfirmado } from '@/emails/reembolso-confirmado'
import { VALOR_CONSULTA_FORMATADO } from '@/lib/constants'
import { creditIdOnlySchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data: role } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (role?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const parsed = creditIdOnlySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
  }
  const { creditId } = parsed.data

  const { error } = await supabaseAdmin
    .from('credits')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
    })
    .eq('id', creditId)
    .eq('status', 'refund_requested')

  if (error) return NextResponse.json({ error: 'Erro ao marcar reembolso.' }, { status: 500 })

  // Buscar perfil do cliente dono do crédito
  const { data: credito } = await supabaseAdmin
    .from('credits')
    .select('user_id')
    .eq('id', creditId)
    .single()

  if (credito) {
    const { data: perfil } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', credito.user_id)
      .single()

    if (perfil) {
      const firstName = perfil.full_name?.split(' ')[0] ?? 'cliente'
      await sendEmail({
        to: perfil.email,
        subject: 'Seu reembolso foi processado ✅',
        template: <EmailReembolsoConfirmado nome={firstName} valor={VALOR_CONSULTA_FORMATADO} />,
      })
    }
  }

  return NextResponse.json({ success: true })
}

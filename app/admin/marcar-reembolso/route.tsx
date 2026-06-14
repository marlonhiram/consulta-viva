import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { EmailReembolsoConfirmado } from '@/emails/reembolso-confirmado'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  const { creditId } = await req.json()
  if (!creditId) return NextResponse.json({ error: 'creditId obrigatório.' }, { status: 400 })

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
        template: <EmailReembolsoConfirmado nome={firstName} valor="R$ 100,00" />,
      })
    }
  }

  return NextResponse.json({ success: true })
}

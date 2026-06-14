import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { EmailReembolsoSolicitado } from '@/emails/reembolso-solicitado'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { creditId } = await req.json()
  if (!creditId) return NextResponse.json({ error: 'creditId obrigatório.' }, { status: 400 })

  // Verificar que o crédito pertence ao usuário e está disponível
  const { data: credito } = await supabaseAdmin
    .from('credits')
    .select('id, user_id, status, amount')
    .eq('id', creditId)
    .eq('user_id', user.id)
    .single()

  if (!credito) return NextResponse.json({ error: 'Crédito não encontrado.' }, { status: 404 })
  if (credito.status !== 'available') return NextResponse.json({ error: 'Este crédito não está disponível para reembolso.' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('credits')
    .update({
      status: 'refund_requested',
      refund_requested_at: new Date().toISOString(),
    })
    .eq('id', creditId)

  if (error) return NextResponse.json({ error: 'Erro ao solicitar reembolso.' }, { status: 500 })

  // TODO: disparar e-mail via Resend para especialista

  const { data: perfil } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  await sendEmail({
      to: process.env.ESPECIALISTA_EMAIL!,
      subject: `Solicitação de reembolso — ${perfil?.full_name ?? 'cliente'}`,
      template: <EmailReembolsoSolicitado nomeCliente={perfil?.full_name ?? 'cliente'} valor="R$ 100,00" />,
  })
  
  return NextResponse.json({ success: true })
}

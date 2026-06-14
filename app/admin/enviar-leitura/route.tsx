import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, SITE_URL } from '@/lib/email'
import { EmailLeituraPronta } from '@/emails/leitura-pronta'

// Service Role — ignora RLS para operações admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { consultationId, analysisSummary } = await req.json()

    if (!consultationId || !analysisSummary?.trim()) {
      return NextResponse.json(
        { error: 'consultationId e analysisSummary são obrigatórios.' },
        { status: 400 }
      )
    }

    // Verifica se a consulta existe e está em estado válido para receber leitura
    const { data: consultation, error: fetchError } = await supabaseAdmin
      .from('consultations')
      .select('id, status, user_id')
      .eq('id', consultationId)
      .single()

    if (fetchError || !consultation) {
      return NextResponse.json(
        { error: 'Consulta não encontrada.' },
        { status: 404 }
      )
    }

    const statusValidos = ['aguardando_analise', 'fotos_recusadas', 'triagem']
    if (!statusValidos.includes(consultation.status)) {
      return NextResponse.json(
        { error: `Consulta com status "${consultation.status}" não pode receber leitura.` },
        { status: 409 }
      )
    }

    // Salva a leitura e atualiza o status para concluida
    const { error: updateError } = await supabaseAdmin
      .from('consultations')
      .update({
        analysis_summary: analysisSummary.trim(),
        status: 'concluida',
        ended_at: new Date().toISOString(),
      })
      .eq('id', consultationId)

    if (updateError) {
      console.error('[enviar-leitura] Erro ao atualizar:', updateError)
      return NextResponse.json(
        { error: 'Erro ao salvar a leitura. Tente novamente.' },
        { status: 500 }
      )
    }

    // Buscar perfil do cliente para e-mail
    const { data: perfil } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', consultation.user_id)
      .single()

    // Precisamos do user_id — buscar na consulta completa
    if (perfil) {
      const firstName = perfil.full_name?.split(' ')[0] ?? 'cliente'
      await sendEmail({
        to: perfil.email,
        subject: 'Sua leitura está pronta! 🔮',
        template: <EmailLeituraPronta nome={firstName} siteUrl={SITE_URL} consultationId={consultationId} />,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[enviar-leitura] Erro inesperado:', err)
    return NextResponse.json(
      { error: 'Erro interno no servidor.' },
      { status: 500 }
    )
  }
}

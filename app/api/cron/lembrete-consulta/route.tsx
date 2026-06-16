import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail, SITE_URL } from '@/lib/email'
import { EmailLembreteConsulta } from '@/emails/lembrete-consulta'

export async function GET(req: NextRequest) {
  // Proteção — só a Vercel pode chamar
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  // Busca consultas agendadas entre 23h e 25h a partir de agora
  const agora = new Date()
  const de = new Date(agora.getTime() + 23 * 60 * 60 * 1000)
  const ate = new Date(agora.getTime() + 25 * 60 * 60 * 1000)

  const { data: consultas, error } = await supabaseAdmin
    .from('consultations')
    .select('id, scheduled_at, user_id')
    .eq('status', 'agendada')
    .gte('scheduled_at', de.toISOString())
    .lte('scheduled_at', ate.toISOString())

  if (error) {
    console.error('[cron/lembrete]', error)
    return NextResponse.json({ error: 'Erro ao buscar consultas.' }, { status: 500 })
  }

  if (!consultas || consultas.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0 })
  }

  let enviados = 0

  for (const c of consultas) {
    const { data: perfil } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', c.user_id)
      .single()

    if (!perfil) continue

    const firstName = perfil.full_name?.split(' ')[0] ?? 'cliente'
    const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
    }).format(new Date(c.scheduled_at))

    await sendEmail({
      to: perfil.email,
      subject: 'Sua consulta é amanhã! 🌿',
      template: <EmailLembreteConsulta nome={firstName} dataHora={dataFormatada} siteUrl={SITE_URL} />,
    })

    enviados++
  }

  return NextResponse.json({ ok: true, enviados })
}
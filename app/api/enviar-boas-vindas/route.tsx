import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, SITE_URL } from '@/lib/email'
import { EmailBoasVindas } from '@/emails/boas-vindas'

export async function POST(req: NextRequest) {
  const { nome, email } = await req.json()

  if (!nome || !email) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  await sendEmail({
    to: email,
    subject: 'Bem-vindo(a) à ConsultaViva 🌿',
    template: <EmailBoasVindas nome={nome} siteUrl={SITE_URL} />,
  })

  return NextResponse.json({ ok: true })
}
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendEmail, SITE_URL } from '@/lib/email'
import { EmailBoasVindas } from '@/emails/boas-vindas'
import { z } from 'zod'

const enviarBoasVindasSchema = z.object({
  nome: z.string().min(1).max(120),
  email: z.string().email('E-mail inválido'),
})

export async function POST(req: NextRequest) {
  const authClient = await createServerSupabaseClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const parsed = enviarBoasVindasSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
  }

  const { nome, email } = parsed.data

  await sendEmail({
    to: email,
    subject: 'Bem-vindo(a) à ConsultaViva 🌿',
    template: <EmailBoasVindas nome={nome} siteUrl={SITE_URL} />,
  })

  return NextResponse.json({ ok: true })
}

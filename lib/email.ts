import { Resend } from 'resend'
import { ReactElement } from 'react'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'Consulta Viva <yurnero14@gmail.com>'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || ''

export { SITE_URL }

export async function sendEmail({
  to,
  subject,
  template,
}: {
  to: string
  subject: string
  template: ReactElement
}) {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      react: template,
    })

    if (error) {
      console.error('[Resend] Erro ao enviar e-mail:', error)
    }
  } catch (err) {
    console.error('[Resend] Falha inesperada:', err)
  }
}
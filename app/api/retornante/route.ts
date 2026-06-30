import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { z } from 'zod'

const MAX_FOTO_BASE64 = 7 * 1024 * 1024 // ~5MB em base64 (base64 expande ~33%)

const retornanteSchema = z.object({
  photos: z
    .array(
      z.string()
        .max(MAX_FOTO_BASE64, 'Foto excede o tamanho máximo de 5MB')
        .regex(/^data:image\/(jpeg|png|webp);base64,/, 'Formato de imagem inválido — use JPEG, PNG ou WEBP')
    )
    .min(1, 'Envie ao menos uma foto')
    .max(5, 'Máximo de 5 fotos por envio'),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const parsed = retornanteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
    }

    const { photos } = parsed.data

    // Cria a nova consultation premium já como concluída
    const { data: consultation, error: consultError } = await supabaseAdmin
      .from('consultations')
      .insert({
        user_id: user.id,
        tipo: 'premium',
        status: 'concluida',
      })
      .select('id')
      .single()

    if (consultError || !consultation) {
      console.error('[retornante] Erro ao criar consulta:', consultError)
      return NextResponse.json({ error: 'Erro ao criar consulta.' }, { status: 500 })
    }

    // Faz upload das fotos no Storage
    if (photos?.length) {
      await Promise.all(
        photos.map(async (base64: string, idx: number) => {
          const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
          const buffer = Buffer.from(base64Data, 'base64')
          const path = `${user.id}/${consultation.id}/foto_${idx + 1}.jpg`

          await supabaseAdmin.storage
            .from('consultation-photos')
            .upload(path, buffer, {
              contentType: 'image/jpeg',
              upsert: true,
            })
        })
      )
    }

    return NextResponse.json({ ok: true, consultationId: consultation.id })

  } catch (err) {
    console.error('[retornante] Erro:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
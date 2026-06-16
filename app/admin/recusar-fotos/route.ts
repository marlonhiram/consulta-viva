import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { recusarFotosSchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const { data: role } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (role?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

    const parsed = recusarFotosSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { consultationId, rejectionReason } = parsed.data

    // Busca a consulta para pegar o photo_rejection_count atual
    const { data: consultation, error: fetchError } = await supabaseAdmin
      .from('consultations')
      .select('id, status, photo_rejection_count')
      .eq('id', consultationId)
      .single()

    if (fetchError || !consultation) {
      return NextResponse.json(
        { error: 'Consulta não encontrada.' },
        { status: 404 }
      )
    }

    const statusValidos = ['aguardando_analise', 'triagem']
    if (!statusValidos.includes(consultation.status)) {
      return NextResponse.json(
        { error: `Consulta com status "${consultation.status}" não pode ter fotos recusadas.` },
        { status: 409 }
      )
    }

    const novoCount = (consultation.photo_rejection_count ?? 0) + 1

    // 1. Atualiza a consulta — status, motivo e contador
    const { error: updateConsultationError } = await supabaseAdmin
      .from('consultations')
      .update({
        status: 'fotos_recusadas',
        photo_rejection_reason: rejectionReason.trim(),
        photo_rejection_count: novoCount,
      })
      .eq('id', consultationId)

    if (updateConsultationError) {
      console.error('[recusar-fotos] Erro ao atualizar consulta:', updateConsultationError)
      return NextResponse.json(
        { error: 'Erro ao recusar fotos. Tente novamente.' },
        { status: 500 }
      )
    }

    // 2. Marca todas as fotos pending desta consulta como rejected
    const { error: updatePhotosError } = await supabaseAdmin
      .from('photos')
      .update({ status: 'rejected' })
      .eq('consultation_id', consultationId)
      .eq('status', 'pending')

    if (updatePhotosError) {
      // Não é fatal — a consulta já foi atualizada. Loga mas não falha.
      console.error('[recusar-fotos] Erro ao marcar fotos como rejected:', updatePhotosError)
    }

    return NextResponse.json({ ok: true, rejection_count: novoCount })
  } catch (err) {
    console.error('[recusar-fotos] Erro inesperado:', err)
    return NextResponse.json(
      { error: 'Erro interno no servidor.' },
      { status: 500 }
    )
  }
}

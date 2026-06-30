import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { z } from 'zod'

const salvarPerfilSchema = z.object({
  email: z.string().email('E-mail inválido'),
  full_name: z.string().min(1).max(120),
  phone: z.string().max(20).optional(),
  hand_dominance: z.enum(['destro', 'canhoto']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

    const parsed = salvarPerfilSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: user.id, ...parsed.data })
      .eq('id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

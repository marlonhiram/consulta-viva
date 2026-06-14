import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const { userId, email, full_name, phone, hand_dominance } = await req.json()
    const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, email, full_name, phone, hand_dominance })
    .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  try {
    /* busca o perfil pelo cancel_token */
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('cancel_token', token)
      .maybeSingle()

    if (error || !profile) {
      /* token inválido ou já usado → página de erro amigável */
      return NextResponse.redirect(
        new URL('/cancelamento-invalido', req.url)
      )
    }

    /* deleta o usuário do Supabase Auth (cascade apaga o perfil) */
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.id)

    if (deleteError) {
      console.error('Erro ao deletar usuário:', deleteError)
      return NextResponse.redirect(
        new URL('/cancelamento-erro', req.url)
      )
    }

    /* redireciona para página de confirmação */
    return NextResponse.redirect(
      new URL('/cancelamento-confirmado', req.url)
    )

  } catch (err) {
    console.error('Erro em /api/cancelar-cadastro:', err)
    return NextResponse.redirect(new URL('/', req.url))
  }
}

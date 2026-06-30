import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-middleware'

// Apenas páginas — rotas de API retornam 401 e não precisam de redirect
const PROTECTED_ROUTES = [
  '/dashboard',
  '/admin',
]

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse } = createMiddlewareClient(request)

  // Sempre usar getUser() — valida o token com o servidor Supabase.
  // Nunca usar getSession() aqui — não valida e pode retornar sessão expirada.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_ROUTES.some(route => path.startsWith(route))

  if (isProtected && !user) {
    const redirectUrl = new URL('/cadastro', request.url)
    redirectUrl.searchParams.set('next', path)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

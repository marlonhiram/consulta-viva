import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-middleware'

const PROTECTED_ROUTES = [
  '/dashboard',
  '/admin',
  '/api/ai-triagem',
  '/api/agendar-consulta',
  '/api/available-slots',
  '/api/cancelar-consulta-cliente',
  '/api/solicitar-reembolso',
  '/api/pagamento',
  '/api/chat',
  '/api/retornante',
  '/api/salvar-perfil',
  '/api/promo/perfil',
  '/api/enviar-boas-vindas',
  '/admin/consultas',
  '/admin/cancelar-consulta',
  '/admin/marcar-reembolso',
  '/admin/enviar-leitura',
  '/admin/recusar-fotos',
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

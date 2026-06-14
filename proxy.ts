import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_ROUTES = ['/', '/cadastro', '/esqueci-senha', '/reset-senha', '/login', '/promocao', '/cancelamento-confirmado', '/cancelamento-invalido', '/cancelamento-erro']
const ADMIN_ROUTES  = ['/admin']

async function handler(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({ request })

  // ── Rotas de API e assets nunca precisam de lógica de redirecionamento ──
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const isPublicRoute = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '?')
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── Não logado ──
  if (!user) {
    if (isPublicRoute) return response
    return NextResponse.redirect(new URL('/', request.url))
  }

  // ── Usuário logado — busca role (1ª query, só para usuários autenticados) ──
  let userRole: string | null = null
  try {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    userRole = roleData?.role ?? null
  } catch { /* trata como cliente */ }

  // ── Admin ──
  if (userRole === 'admin') {
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/')) return response
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // ── Cliente tentando acessar /admin ──
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── A partir daqui só precisa da consultation em rotas específicas ──
  const needsConsultation =
    isPublicRoute ||
    pathname === '/dashboard' ||
    pathname === '/dashboard/triagem'

  if (!needsConsultation) return response

  // ── 2ª query — só quando realmente necessário ──
  const { data: consultation } = await supabase
    .from('consultations')
    .select('status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const consultationStatus = consultation?.status ?? null

  // Cliente logado em rota pública → redireciona para área correta
  if (isPublicRoute) {
    if (consultationStatus === 'triagem') {
      return NextResponse.redirect(new URL('/dashboard/triagem', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Cliente em /dashboard → se está em triagem, manda para triagem
  if (pathname === '/dashboard') {
    if (consultationStatus === 'triagem') {
      return NextResponse.redirect(new URL('/dashboard/triagem', request.url))
    }
    return response
  }

  // Cliente em /dashboard/triagem → se já concluiu, manda para dashboard
  if (pathname === '/dashboard/triagem') {
    if (consultationStatus !== null && consultationStatus !== 'triagem') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  return response
}

export const middleware = handler
export const proxy = handler

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { LogoutButton } from '@/components/shared/LogoutButton'
import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function AtendimentoPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const userRole = token
    ? JSON.parse(atob(token.split('.')[1]))?.user_role
    : null

  if (userRole !== 'admin') redirect('/dashboard')

  return (
    <main className="min-h-dvh bg-quiros-dark flex flex-col">
      <header className="border-b border-quiros-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-quiros-muted hover:text-quiros-cream text-sm transition-colors">
            ← Admin
          </a>
          <span className="text-quiros-border">/</span>
          <p className="font-display text-lg text-quiros-cream tracking-wide">
            Atendimento
          </p>
        </div>
        <LogoutButton />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
        <p className="font-body text-xs tracking-[0.3em] text-quiros-gold uppercase">
          Workstation
        </p>
        <h1 className="font-display text-3xl text-quiros-cream text-center">
          Consulta #{id.slice(0, 8)}
        </h1>
        <p className="text-quiros-muted text-sm text-center max-w-xs">
          Visualização de fotos em alta resolução com zoom, rotação e editor
          de texto rico serão implementados na Fase 5.
        </p>
      </div>

      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-quiros-border">
          L06 — Workstation · Rota: /admin/atendimento/[id]
        </p>
      </footer>
    </main>
  )
}

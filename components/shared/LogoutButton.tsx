'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="
        px -5 py-2 text-sm font-body tracking-wider
        border transition-all duration-200
      "
      style={{
        border: '1px solid var(--border)',
        color: 'var(--muted)',
        borderRadius: '2px',
        background: 'transparent',
        fontFamily: 'var(--font-body)',
        letterSpacing: '0.2em',
        fontSize: '10px',
        textTransform: 'uppercase' as const,
      }}
    >
      Sair
    </button>
  )
}

'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

/* ─── Logout ─────────────────────────────────────────────────────────────── */

export function LogoutBtn() {
  const supabase = createClient()
  const router = useRouter()
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }
  return <button className="logout-btn" onClick={handleLogout}>Sair</button>
}

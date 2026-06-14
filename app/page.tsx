import { createServerSupabaseClient } from '@/lib/supabase-server'
import LandingClient from './LandingClient'

export default async function LandingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <LandingClient isLoggedIn={!!user} />
}

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AdminClient from './AdminClient'

export const metadata = {
  title: 'Painel da Especialista | Quiros',
}

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/cadastro')
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!roleData || roleData.role !== 'admin') {
    redirect('/dashboard')
  }

  return <AdminClient />
}

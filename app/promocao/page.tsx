import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PromoClient from './PromoClient'

export const metadata = {
  title: 'Análise Gratuita — ConsultaViva',
  description: 'Receba uma análise especializada e personalizada, sem custo. Conecte-se com quem entende você.',
}

export default async function PromoPage() {
  const supabase = await createServerSupabaseClient()

  const { data: promo } = await supabase
    .from('promocoes')
    .select('id, limite, usadas, expira_em')
    .eq('tipo', 'leitura_gratuita')
    .eq('ativa', true)
    .gt('expira_em', new Date().toISOString())
    .maybeSingle()

  /* sem promoção ativa ou vagas esgotadas → home */
  if (!promo || promo.usadas >= promo.limite) {

    const { data: promo, error } = await supabase
    .from('promocoes')
    .select('id, limite, usadas, expira_em')
    .eq('tipo', 'leitura_gratuita')
    .eq('ativa', true)
    .gt('expira_em', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  console.log('PROMO:', promo)
  console.log('ERROR:', error)

if (!promo || promo.usadas >= promo.limite) {
  redirect('/')
}
    redirect('/')
  }

  return <PromoClient promo={promo} />
}

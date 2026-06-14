import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function validarCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, '')
  if (nums.length !== 11 || /^(\d)\1+$/.test(nums)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(nums[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(nums[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(nums[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(nums[10])
}

export async function POST(req: NextRequest) {
  const { cpf } = await req.json()
  const cpfLimpo = (cpf ?? '').replace(/\D/g, '')

  if (!validarCPF(cpfLimpo)) {
    return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  // Verifica se CPF já existe em outro usuário
  const { data: existente } = await supabase
    .from('profiles')
    .select('id')
    .eq('cpf', cpfLimpo)
    .neq('id', user.id)
    .single()

  if (existente) {
    return NextResponse.json(
      { error: 'Este CPF já foi utilizado para uma leitura gratuita.' },
      { status: 409 }
    )
  }

  // Salva CPF no profile
  const { error } = await supabase
    .from('profiles')
    .update({ cpf: cpfLimpo })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Erro ao salvar CPF.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

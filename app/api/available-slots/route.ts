import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date') // formato: 2026-04-25

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: 'Parâmetro date inválido.' }, { status: 400 })
  }

  // Buscar configuração da agenda
  const { data: config, error: configError } = await supabaseAdmin
    .from('agenda_config')
    .select('work_days, start_time, end_time, slot_duration_minutes, break_between_minutes')
    .single()

  if (configError || !config) {
    return NextResponse.json({ error: 'Configuração de agenda não encontrada.' }, { status: 500 })
  }

  // Verificar se o dia da semana é permitido (0=Dom, 1=Seg, ..., 6=Sáb)
  // O banco usa 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb (isoWeekday)
  const [year, month, day] = dateParam.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)
  const jsDay = dateObj.getDay() // 0=Dom, 1=Seg... 6=Sáb
  // Converter JS day para iso (1=Seg...6=Sáb, 7=Dom)
  const isoDay = jsDay === 0 ? 7 : jsDay

  if (!config.work_days.includes(isoDay)) {
    return NextResponse.json({ slots: [], motivo: 'Dia não disponível para agendamento.' })
  }

  // Gerar todos os slots do dia
  const [startH, startM] = config.start_time.split(':').map(Number)
  const [endH, endM] = config.end_time.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  const interval = config.slot_duration_minutes + config.break_between_minutes // 35min

  const allSlots: string[] = []
  for (let m = startMinutes; m + config.slot_duration_minutes <= endMinutes; m += interval) {
    const h = Math.floor(m / 60)
    const min = m % 60
    // Montar ISO string em America/Sao_Paulo (UTC-3)
    const slotISO = `${dateParam}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00-03:00`
    allSlots.push(slotISO)
  }

  // Buscar bloqueios manuais que se sobrepõem ao dia
  const dayStart = `${dateParam}T00:00:00-03:00`
  const dayEnd = `${dateParam}T23:59:59-03:00`

  const { data: blocks } = await supabaseAdmin
    .from('agenda_blocks')
    .select('starts_at, ends_at')
    .lte('starts_at', dayEnd)
    .gte('ends_at', dayStart)

  const { data: consultations } = await supabaseAdmin
    .from('consultations')
    .select('scheduled_at')
    .eq('status', 'agendada')
    .gte('scheduled_at', dayStart)
    .lte('scheduled_at', dayEnd)

  const blockedTimes = new Set<string>()

  // Bloquear slots que colidem com agenda_blocks
  for (const block of blocks ?? []) {
    const blockStart = new Date(block.starts_at).getTime()
    const blockEnd = new Date(block.ends_at).getTime()
    for (const slot of allSlots) {
      const slotStart = new Date(slot).getTime()
      const slotEnd = slotStart + config.slot_duration_minutes * 60 * 1000
      if (slotStart < blockEnd && slotEnd > blockStart) {
        blockedTimes.add(slot)
      }
    }
  }

  // Bloquear slots já agendados
  for (const c of consultations ?? []) {
    if (!c.scheduled_at) continue
    const consultStart = new Date(c.scheduled_at).getTime()
    for (const slot of allSlots) {
      const slotStart = new Date(slot).getTime()
      if (Math.abs(slotStart - consultStart) < 60 * 1000) {
        blockedTimes.add(slot)
      }
    }
  }

  // Bloquear slots no passado
  const agora = Date.now()
  const slotsLivres = allSlots.filter(slot => {
    if (blockedTimes.has(slot)) return false
    if (new Date(slot).getTime() <= agora) return false
    return true
  })

  return NextResponse.json({ slots: slotsLivres })
}

/**
 * Funções utilitárias do painel da especialista (formatação de datas,
 * cálculo de SLA, geração de slots de agenda).
 *
 * ATENÇÃO: `now` é calculado uma única vez na carga do módulo (comportamento
 * original preservado). `getSlaInfo` depende disso — não tornar dinâmico
 * sem validar o impacto no cálculo de prazo das solicitações.
 */
const now = new Date()

export function getSlaInfo(createdAt: string) {
  const deadline = new Date(new Date(createdAt).getTime() + 48 * 60 * 60 * 1000)
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursLeft <= 0) return { label: '⚠️ Prazo vencido', badgeClass: 'admin__badge--red', hoursLeft }
  if (hoursLeft <= 24) return { label: `🟡 ${Math.ceil(hoursLeft)}h restantes`, badgeClass: 'admin__badge--yellow', hoursLeft }
  return { label: `🟢 ${Math.ceil(hoursLeft)}h restantes`, badgeClass: 'admin__badge--green', hoursLeft }
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })
}

export function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

export function chatDisponivel(scheduled_at: string): boolean {
  const agora = Date.now()
  const horario = new Date(scheduled_at).getTime()
  return agora >= horario - 5 * 60 * 1000 && agora <= horario + 35 * 60 * 1000
}

const WORK_START = 9
const WORK_END = 18
const SLOT_DURATION = 35

export function generateTimeSlots(): string[] {
  const slots: string[] = []
  let current = WORK_START * 60
  while (current + 30 <= WORK_END * 60) {
    const h = Math.floor(current / 60)
    const m = current % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    current += SLOT_DURATION
  }
  return slots
}

export const TIME_SLOTS = generateTimeSlots()

export function getWeekDays(baseDate: Date): Date[] {
  const monday = new Date(baseDate)
  const dayOfWeek = monday.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  monday.setDate(monday.getDate() + diff)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

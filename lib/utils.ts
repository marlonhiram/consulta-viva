// ---- Formatação de datas ----

/** Formata timestamp para "DD/MM/AAAA às HH:mm" no fuso de Brasília (UTC-3) */
export function formatDateBR(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(date))
}

/** Retorna quantos segundos faltam até uma data futura. Nunca negativo. */
export function secondsUntil(targetISO: string): number {
  return Math.max(0, Math.floor((new Date(targetISO).getTime() - Date.now()) / 1000))
}

/** Converte segundos em string "MM:SS" para o cronômetro da L05 */
export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const s = (totalSeconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ---- Perfil ----

type Profile = {
  full_name: string | null
  birth_date: string | null
  hand_dominance: string | null
}

/**
 * Verifica se o perfil foi preenchido completamente durante a triagem.
 * Usado pelo middleware para decidir o redirect inteligente.
 */
export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false
  return !!(profile.full_name && profile.birth_date && profile.hand_dominance)
}

// ---- Strings ----

/** Retorna as iniciais do nome para avatars (ex: "Maria Silva" → "MS") */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

/** Trunca um texto longo com reticências */
export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text
}

/**
 * Funções utilitárias da área do cliente (saudação, formatação de datas,
 * formatação de CPF, disponibilidade de chat e label de status de crédito).
 */

export function saudacao(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

export function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

export function chatDisponivel(scheduled_at: string | null): boolean {
  if (!scheduled_at) return false
  const agora = Date.now()
  const horario = new Date(scheduled_at).getTime()
  return agora >= horario - 5 * 60 * 1000 && agora <= horario + 35 * 60 * 1000
}

export function formatarCPF(valor: string) {
  return valor
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

export function labelStatusCredito(status: string): string {
  switch (status) {
    case 'available': return '🟢 Disponível'
    case 'used': return '✅ Utilizado'
    case 'refund_requested': return '🔄 Reembolso solicitado'
    case 'refunded': return '💰 Reembolsado'
    default: return status
  }
}

/**
 * Tipos compartilhados entre o AdminClient e seus subcomponentes
 * (tabs, modais e WorkView).
 */

export type ConsultationStatus =
  | 'triagem' | 'aguardando_analise' | 'fotos_recusadas'
  | 'agendada' | 'em_andamento' | 'concluida' | 'cancelada'

export type Tab = 'solicitacoes' | 'realizadas' | 'agenda' | 'reembolsos'

export interface MockPhoto {
  id: string
  url: string
  hand_type: string
}

export interface MockConsultation {
  id: string
  client_name: string
  client_email: string
  created_at: string
  status: ConsultationStatus
  tipo: string | null
  photos: MockPhoto[]
  messages_preview: string
  birth_date: string
  hand_dominance: string
}

export interface AgendaBlock {
  id: string
  starts_at: string
  ends_at: string
  reason: string
  type: 'manual' | 'presencial' | 'bloqueado'
}

export interface AgendaConsultation {
  id: string
  scheduled_at: string
  status: ConsultationStatus
  client_name: string
  client_email: string
}

export interface ReembolsoItem {
  id: string
  user_id: string
  amount: number
  status: string
  created_at: string
  refund_requested_at: string | null
  client_name: string
  client_email: string
}

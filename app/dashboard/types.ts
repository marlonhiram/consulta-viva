/**
 * Tipos compartilhados entre o DashboardClient e seus subcomponentes (modais).
 */

export type Consultation = {
  id: string
  status: string
  tipo: string | null
  scheduled_at: string | null
  analysis_summary: string | null
  created_at: string
  photo_rejection_reason: string | null
  photo_rejection_count: number | null
}

export type Credit = {
  id: string
  origin: string
  amount: number
  status: string
  created_at: string
  used_at: string | null
  used_for_consultation_id: string | null
}

export type Props = {
  userName: string
  userInitials: string
  userEmail: string
  userFullName: string
  consultation: Consultation | null
  historico: Consultation[]
  creditos: Credit[]
}

export type Politica = {
  id: string
  titulo: string
  icone: string
  conteudo: string
}

import { z } from 'zod'

// ---- Cadastro ----
export const signUpSchema = z.object({
  full_name: z
    .string()
    .min(3, 'Nome deve ter ao menos 3 caracteres')
    .max(120, 'Nome muito longo'),
  email: z
    .string()
    .email('E-mail inválido'),
  phone: z
    .string()
    .optional(),
  password: z
    .string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .max(72, 'Senha muito longa'),
  confirm_password: z
    .string()
    .optional(),
  hand_dominance: z
    .enum(['destro', 'canhoto']).refine(val => !!val, { message: 'Informe com qual mão você escreve.' }).optional(),
})

export type SignUpInput = z.infer<typeof signUpSchema>

// ---- Login ----
export const signInSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})

export type SignInInput = z.infer<typeof signInSchema>

// ---- Upload de foto ----
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB (conforme Seção 2.3 do doc)

export const photoUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine(
      (f) => ACCEPTED_IMAGE_TYPES.includes(f.type),
      'Apenas JPG, PNG ou WEBP são aceitos'
    )
    .refine(
      (f) => f.size <= MAX_FILE_SIZE_BYTES,
      'A foto deve ter no máximo 5MB'
    ),
  hand_type: z.enum(['direita', 'esquerda', 'perfil', 'rosto']),
})

export type PhotoUploadInput = z.infer<typeof photoUploadSchema>

// ---- Rotas de API (body de requisição) ----
const uuid = z.string().uuid('ID inválido')

export const criarPixSchema = z.object({
  consultationId: uuid,
  userEmail: z.string().email('E-mail inválido'),
  userName: z.string().min(1, 'Nome obrigatório').max(120),
})
export type CriarPixInput = z.infer<typeof criarPixSchema>

export const agendarConsultaSchema = z.object({
  consultationId: uuid,
  startsAt: z.string().datetime({ message: 'Data/hora inválida' }).or(z.string().min(1)),
})
export type AgendarConsultaInput = z.infer<typeof agendarConsultaSchema>

export const consultationIdOnlySchema = z.object({
  consultationId: uuid,
})
export type ConsultationIdOnlyInput = z.infer<typeof consultationIdOnlySchema>

export const creditIdOnlySchema = z.object({
  creditId: uuid,
})
export type CreditIdOnlyInput = z.infer<typeof creditIdOnlySchema>

export const enviarMensagemSchema = z.object({
  consultationId: uuid,
  content: z.string().min(1, 'Mensagem vazia').max(4000, 'Mensagem muito longa'),
  messageType: z.enum(['text', 'image']).optional(),
})
export type EnviarMensagemInput = z.infer<typeof enviarMensagemSchema>

export const enviarLeituraSchema = z.object({
  consultationId: uuid,
  analysisSummary: z.string().min(10, 'Análise muito curta'),
})
export type EnviarLeituraInput = z.infer<typeof enviarLeituraSchema>

export const recusarFotosSchema = z.object({
  consultationId: uuid,
  rejectionReason: z.string().min(10, 'Motivo muito curto'),
})
export type RecusarFotosInput = z.infer<typeof recusarFotosSchema>

export const cancelarConsultaAdminSchema = z.object({
  consultationId: uuid,
  reason: z.string().min(10, 'Motivo muito curto'),
})
export type CancelarConsultaAdminInput = z.infer<typeof cancelarConsultaAdminSchema>

export const aiTriagemSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ text: z.string() })).length(1),
    })
  ),
  photosConfirmed: z.boolean().optional(),
  consultationId: uuid.optional(),
  photos: z.array(z.string()).optional(),
})
export type AiTriagemInput = z.infer<typeof aiTriagemSchema>

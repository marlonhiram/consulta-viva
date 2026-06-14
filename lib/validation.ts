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
  hand_type: z.enum(['direita', 'esquerda', 'perfil']),
})

export type PhotoUploadInput = z.infer<typeof photoUploadSchema>

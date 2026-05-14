import { JwtPayload } from 'jsonwebtoken'
import z from 'zod'
import { TokenType } from '~/constants/enums'
import { Role } from '~/generated/prisma/enums'

export const TokenPayloadSchema = z.object({
  user_id: z.uuid(),
  token_type: z.enum(TokenType),
  isVerified: z.boolean(),
  role: z.enum(Role),
  email: z.email(),

  // optinal mặc định có trong token JWT
  iat: z.number().optional(),
  exp: z.number().optional()
})

export type TokenPayload = z.infer<typeof TokenPayloadSchema> & JwtPayload
export type SignTokenPayload = Omit<z.infer<typeof TokenPayloadSchema>, 'iat' | 'exp' | 'token_type'>

// JWT Table Session Token scan QR Code
export const TableTokenPayloadSchema = z.object({
  tableId: z.string().min(1, 'Table ID không được để trống'),
  name: z.string().min(1, 'Tên không được để trống'),
  sessionId: z.uuid('Session ID phải đúng định dạng UUID')
})
export type TableTokenSessionPayload = z.infer<typeof TableTokenPayloadSchema> & JwtPayload

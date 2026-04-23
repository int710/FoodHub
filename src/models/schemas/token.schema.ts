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

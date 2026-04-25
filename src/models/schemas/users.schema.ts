import z from 'zod'
import { REGEX_PASSWORD } from '~/constants/regex'

// Register
export const registerBodySchema = z
  .object({
    email: z.email({ error: 'Email không đúng định dạng' }),
    password: z
      .string()
      .trim()
      .min(6, 'Mật khẩu tối thiểu 6 kí tự')
      .max(30, { error: 'Mật khẩu tối đa 30 kí tự' })
      .regex(REGEX_PASSWORD, { error: ' Mật khẩu phải bao gồm chữ cái, số và kí tự đặc biệt' }),
    confirmPassword: z.string({ error: 'Vui lòng xác nhận mật khẩu' }).trim(),
    name: z.string().trim().max(100, { error: 'Tên không được dài quá 100 kí tự' }),
    dateOfBirth: z.coerce.date({ error: 'Ngày sinh không đúng định dạng (YYYY-MM-DD)' }).optional()
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword']
  })

export const registerReqSchema = z.object({
  body: registerBodySchema
})
export type RegisterRequestBody = z.infer<typeof registerBodySchema>

// Login
export const loginBodySchema = z.object({
  email: z.email({ error: 'Email không đúng định dạng' }),
  password: z.string().trim().min(6, { error: 'Mật khẩu tối thiểu 6 kí tự' })
})
export const loginReqBody = z.object({
  body: loginBodySchema
})
export type LoginReqBody = z.infer<typeof loginBodySchema>

// Logout or RefreshToken
const refreshTokenSchema = z.object({
  refresh_token: z.string({ error: 'RefreshToken is invalid' })
})
export const logoutReqBody = z.object({
  body: refreshTokenSchema
})
export type LogoutReqBody = z.infer<typeof refreshTokenSchema>
export type RefreshTokenReq = z.infer<typeof refreshTokenSchema>

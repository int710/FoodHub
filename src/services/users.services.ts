import { Request } from 'express'
import { JsonWebTokenError } from 'jsonwebtoken'
import { prisma } from '~/config/prisma'
import { TokenType } from '~/constants/enums'
import HTTP_STATUS from '~/constants/httpStatus'
import { USER_MESSAGE } from '~/constants/message'
import { ErrorWithStatus } from '~/models/Errors'
import { SignTokenPayload } from '~/models/schemas/token.schema'
import { RegisterRequestBody } from '~/models/schemas/users.schema'
import { comparePassword, hashPassword } from '~/utils/crypto'
import { signToken, verifyToken } from '~/utils/jwt'

class UserServices {
  private signAccessToken(payload: SignTokenPayload) {
    return signToken({
      payload: { ...payload, token_type: TokenType.AccessToken },
      secretOrPrivateKey: process.env.SECRET_ACCESS_TOKEN as string,
      options: {
        expiresIn: '30m'
      }
    })
  }

  private signRefreshToken(payload: SignTokenPayload) {
    return signToken({
      payload: { ...payload, token_type: TokenType.RefreshToken },
      secretOrPrivateKey: process.env.SECRET_REFRESH_TOKEN as string,
      options: {
        expiresIn: '7d'
      }
    })
  }

  private async signAccessAndRefreshToken(payload: SignTokenPayload) {
    return Promise.all([this.signAccessToken(payload), this.signRefreshToken(payload)])
  }

  async register(payload: RegisterRequestBody) {
    const { email, password, name, dateOfBirth } = payload
    const isEmailExists = await prisma.user.findUnique({ where: { email } })
    if (isEmailExists) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.CONFLICT,
        message: USER_MESSAGE.EMAIL_ALREADY_EXISTS
      })
    }

    const newUser = await prisma.user.create({
      data: { email, name, password: await hashPassword(password), dateOfBirth },
      select: { email: true, name: true, dateOfBirth: true }
    })

    return newUser
  }

  async login(email: string, password: string, req: Request) {
    const user = await prisma.user.findUnique({ where: { email } })
    const isMatch = user && (await comparePassword(password, user.password))
    if (!isMatch) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
        message: USER_MESSAGE.EMAIL_OR_PASSWORD_IS_INVALID
      })
    }

    // Lấy thông tin để tiến hành signToken
    const payloadToken: SignTokenPayload = {
      user_id: user.id,
      isVerified: user.isVerified,
      role: user.role,
      email: user.email
    }

    const [access_token, refresh_token] = await this.signAccessAndRefreshToken(payloadToken)

    await prisma.refreshToken.create({
      data: {
        token: refresh_token as string,
        userId: user.id,
        deviceIP: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })

    return { access_token, refresh_token }
  }

  async logout(refresh_token: string) {
    const stored = await prisma.refreshToken.findFirst({ where: { token: refresh_token } })
    if (stored && !stored.revokeAt) {
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokeAt: new Date(), revokeReason: 'LOGOUT' }
      })
    }
  }

  async refreshToken(refresh_token: string, req: Request) {
    try {
      // Verify token kiểm tra tính hợp lệ
      const [decoded_token, storedToken] = await Promise.all([
        verifyToken({ token: refresh_token, secretOrPrivateKey: process.env.SECRET_REFRESH_TOKEN as string }),
        prisma.refreshToken.findFirst({ where: { token: refresh_token } })
      ])

      if (decoded_token.token_type !== TokenType.RefreshToken) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: USER_MESSAGE.THIS_TOKEN_IS_NOT_A_REFRESH_TOKEN_TYPE
        })
      }

      if (!storedToken) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.NOT_FOUND,
          message: USER_MESSAGE.REFRESH_TOKEN_IS_NOT_EXISTS
        })
      }

      if (storedToken.expiresAt < new Date()) {
        await prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokeAt: new Date(), revokeReason: 'EXPIRED' }
        })
        throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.UNAUTHORIZED, message: USER_MESSAGE.TOKEN_HAS_EXPIRED })
      }
      // Dùng refreshToken cũ thì revoke toàn bộ nghi vấn hack
      if (storedToken.revokeAt) {
        await prisma.refreshToken.updateMany({
          where: { userId: storedToken.userId, revokeAt: null },
          data: { revokeAt: new Date(), revokeReason: 'REUSED_DETECTED' }
        })
        return null
      }

      const newPayloadToken: SignTokenPayload = {
        email: decoded_token.email,
        isVerified: decoded_token.isVerified,
        role: decoded_token.role,
        user_id: decoded_token.user_id
      }

      const [new_access_token, new_refresh_token] = await this.signAccessAndRefreshToken(newPayloadToken)

      await Promise.all([
        prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokeAt: new Date(), revokeReason: 'ROTATED' }
        }),
        prisma.refreshToken.create({
          data: {
            token: new_refresh_token as string,
            userId: storedToken.userId,
            deviceIP: req.ip,
            userAgent: req.headers['user-agent'],
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        })
      ])

      return { access_token: new_access_token, refresh_token: new_refresh_token }
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.UNAUTHORIZED, message: error.message })
      }
      throw error
    }
  }
}

const userServices = new UserServices()
export default userServices

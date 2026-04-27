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
import { sendEmailForgotPassword, sendVerifyEmail } from '~/utils/send-email'

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

  private async genarateEmailVerifyToken(payload: SignTokenPayload) {
    return signToken({
      payload: { ...payload, token_type: TokenType.VerifyEmailToken },
      secretOrPrivateKey: process.env.SECRET_VERIFY_EMAIL as string,
      options: {
        expiresIn: '30d'
      }
    })
  }

  private async genarateForgotPasswordToken(payload: SignTokenPayload) {
    return signToken({
      payload: { ...payload, token_type: TokenType.ForgotPasswordToken },
      secretOrPrivateKey: process.env.SECRET_FORGOT_PASSWORD as string,
      options: { expiresIn: '12h' }
    })
  }

  async register(payload: RegisterRequestBody, clientIP: string, userAgent: string) {
    const { email, password, name, dateOfBirth } = payload
    const isEmailExists = await prisma.user.findUnique({ where: { email } })
    if (isEmailExists) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.CONFLICT,
        message: USER_MESSAGE.EMAIL_ALREADY_EXISTS
      })
    }
    const newUser = await prisma.user.create({
      data: { email, name, password: await hashPassword(password), dateOfBirth }
    })

    const payloadDataToken: SignTokenPayload = {
      user_id: newUser.id,
      email: newUser.email,
      isVerified: newUser.isVerified,
      role: newUser.role
    }
    const [tokens_arr, verify_email_token_raw] = await Promise.all([
      this.signAccessAndRefreshToken(payloadDataToken),
      this.genarateEmailVerifyToken(payloadDataToken)
    ])
    const [access_token, refresh_token] = tokens_arr as [string, string]
    const verify_email_token = verify_email_token_raw as string

    await Promise.all([
      prisma.user.update({ where: { id: newUser.id }, data: { verifyEmailToken: verify_email_token } }),
      prisma.refreshToken.create({
        data: {
          token: refresh_token,
          userId: newUser.id,
          deviceIP: clientIP,
          userAgent,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      })
    ])
    sendVerifyEmail({ to: newUser.email, name: newUser.name, verifyToken: verify_email_token })
    return { access_token, refresh_token }
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

  async getProfile(user_id: string) {
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        avatar: true,
        dateOfBirth: true,
        isActive: true,
        isVerified: true,
        createdAt: true
      }
    })

    if (!user) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: USER_MESSAGE.USER_NOT_FOUND })
    }
    return user
  }

  async verifyEmail(verify_email_token: string) {
    try {
      if (!verify_email_token) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.BAD_REQUEST,
          message: USER_MESSAGE.VERIFY_EMAIL_TOKEN_IS_REQUIRED
        })
      }

      const decoded_verify_email_token = await verifyToken({
        token: verify_email_token,
        secretOrPrivateKey: process.env.SECRET_VERIFY_EMAIL as string
      })

      const user = await prisma.user.findUnique({ where: { id: decoded_verify_email_token.user_id } })
      if (!user) {
        throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: USER_MESSAGE.USER_NOT_FOUND })
      }
      if (user.isVerified) {
        return USER_MESSAGE.EMAIL_ALREADY_VERIFY_BEFORE
      }

      if (user && user.isVerified === false && user.verifyEmailToken !== verify_email_token) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: USER_MESSAGE.VERIFY_EMAIL_TOKEN_IS_INVALID
        })
      } else if (user && user.isVerified === false && user.verifyEmailToken === verify_email_token) {
        await prisma.user.update({ where: { id: user.id }, data: { verifyEmailToken: null, isVerified: true } })
        return USER_MESSAGE.VERIFY_EMAIL_SUCCESS
      }
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.UNAUTHORIZED, message: error.message })
      }
      throw error
    }
  }

  async forgotPassword(email: string) {
    if (!email) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: USER_MESSAGE.EMAIL_IS_REQUIRED })
    }
    const user = await prisma.user.findUnique({ where: { email: email } })
    if (user) {
      const payload: SignTokenPayload = {
        user_id: user.id,
        email: user.email,
        isVerified: user.isVerified,
        role: user.role
      }
      const forgotPassToken = (await this.genarateForgotPasswordToken(payload)) as string
      await prisma.user.update({ where: { id: user.id }, data: { forgotPasswordToken: forgotPassToken } })
      sendEmailForgotPassword({ to: user.email, name: user.name, forgotPasswordToken: forgotPassToken })
    }
    return USER_MESSAGE.IF_EMAIL_EXISTS
  }

  async resetPassword(token: string, newPass: string) {
    try {
      const decoded_token = await verifyToken({
        token,
        secretOrPrivateKey: process.env.SECRET_FORGOT_PASSWORD as string
      })
      const user = await prisma.user.findUnique({ where: { id: decoded_token.user_id } })
      if (!user) {
        throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: USER_MESSAGE.USER_NOT_FOUND })
      }
      if (decoded_token.token_type !== TokenType.ForgotPasswordToken) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: USER_MESSAGE.FORGOT_PASSTOKEN_IS_INVALID
        })
      }
      if (user.forgotPasswordToken !== token) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: USER_MESSAGE.FORGOT_PASSTOKEN_IS_INVALID
        })
      }

      Promise.all([
        prisma.user.update({
          where: { id: user.id },
          data: {
            password: await hashPassword(newPass),
            forgotPasswordToken: null
          }
        }),
        prisma.refreshToken.updateMany({
          where: { userId: user.id, revokeAt: null },
          data: { revokeAt: new Date(), revokeReason: 'RESET_PASSWORD' }
        })
      ])

      return USER_MESSAGE.RESET_PASSWORD_SUCCESS
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

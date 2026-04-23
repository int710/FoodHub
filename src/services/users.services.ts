import { Request } from 'express'
import { prisma } from '~/config/prisma'
import { TokenType } from '~/constants/enums'
import HTTP_STATUS from '~/constants/httpStatus'
import { USER_MESSAGE } from '~/constants/message'
import { ErrorWithStatus } from '~/models/Errors'
import { SignTokenPayload } from '~/models/schemas/token.schema'
import { RegisterRequestBody } from '~/models/schemas/users.schema'
import { comparePassword, hashPassword } from '~/utils/crypto'
import { signToken } from '~/utils/jwt'

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
}

const userServices = new UserServices()
export default userServices

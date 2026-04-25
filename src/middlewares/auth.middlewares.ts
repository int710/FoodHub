import { NextFunction, Request, Response } from 'express'
import { JsonWebTokenError } from 'jsonwebtoken'
import HTTP_STATUS from '~/constants/httpStatus'
import { USER_MESSAGE } from '~/constants/message'
import { ErrorWithStatus } from '~/models/Errors'
import { verifyToken } from '~/utils/jwt'

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accessToken = req.headers?.authorization?.split(' ')[1]
    if (!accessToken || accessToken === null) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
        message: USER_MESSAGE.ACCESS_TOKEN_IS_REQUIRED
      })
    }

    const decoded_authorization = await verifyToken({
      token: accessToken,
      secretOrPrivateKey: process.env.SECRET_ACCESS_TOKEN as string
    })

    req.decoded_authorization = decoded_authorization
    next()
  } catch (error) {
    if (error instanceof JsonWebTokenError) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
        message: USER_MESSAGE.TOKEN_PAYLOAD_IS_INVALID
      })
    }
    throw error
  }
}

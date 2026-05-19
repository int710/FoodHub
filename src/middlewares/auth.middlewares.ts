import { NextFunction, Request, Response } from 'express'
import { redis } from '~/config/redis'
import HTTP_STATUS from '~/constants/httpStatus'
import { USER_MESSAGE } from '~/constants/message'
import { RedisKey } from '~/constants/redis'
import { ErrorWithStatus } from '~/models/Errors'
import { TableTokenPayloadSchema, TokenPayloadSchema } from '~/models/schemas/token.schema'
import { verifyToken } from '~/utils/jwt'

async function verifyAccess(headers?: string) {
  if (!headers?.startsWith('Bearer ')) return null
  const accessToken = headers.split(' ')[1]
  const decoded_authorization = await verifyToken({
    token: accessToken,
    secretOrPrivateKey: process.env.SECRET_ACCESS_TOKEN as string,
    schema: TokenPayloadSchema
  })
  return decoded_authorization
}

async function verifyTable(headers?: string) {
  if (!headers) return null
  const decoded_tableTokenSession = await verifyToken({
    token: headers,
    secretOrPrivateKey: process.env.SECRET_TABLE_TOKEN as string,
    schema: TableTokenPayloadSchema
  })

  const rawSession = await redis.get(RedisKey.tableSession(decoded_tableTokenSession.sessionId))
  if (!rawSession) {
    throw new ErrorWithStatus({
      httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
      message: 'Phiên đã hết hạn vui lòng scan lại QR'
    })
  }

  if (rawSession !== decoded_tableTokenSession.tableId) {
    throw new ErrorWithStatus({
      httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
      message: 'Token không khớp với phiên đăng nhập của bàn này, vui lòng thử lại'
    })
  }
  return decoded_tableTokenSession
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const decoded_authorization = await verifyAccess(req.headers.authorization)
    if (!decoded_authorization) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
        message: USER_MESSAGE.ACCESS_TOKEN_IS_REQUIRED
      })
    }
    req.decoded_authorization = decoded_authorization
    next()
  } catch (error) {
    next(error)
  }
}

export const tableSessionAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const decoded_tableTokenSession = await verifyTable(req.headers['x-table-token'] as string)
    if (!decoded_tableTokenSession) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
        message: USER_MESSAGE.TABLE_TOKEN_IS_INVALID
      })
    }
    req.decoded_tokenTableSession = decoded_tableTokenSession
    next()
  } catch (error) {
    next(error)
  }
}

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [user, table] = await Promise.all([
      verifyAccess(req.headers.authorization as string).catch((e) => {
        if (req.headers.authorization) throw e
        return null
      }),
      verifyTable(req.headers['x-table-token'] as string).catch((err) => {
        if (req.headers['x-table-token']) throw err
        return null
      })
    ])
    req.decoded_authorization = user || undefined
    req.decoded_tokenTableSession = table || undefined
    next()
  } catch (error) {
    next(error)
  }
}

export const validateTable = async (req: Request, res: Response, next: NextFunction) => {
  const isCustomer = req.decoded_tokenTableSession
  if (!isCustomer || isCustomer === null) {
    throw new ErrorWithStatus({
      httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
      message: USER_MESSAGE.TABLE_TOKEN_IS_INVALID
    })
  }
  next()
}

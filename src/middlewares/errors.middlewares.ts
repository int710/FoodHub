import { NextFunction, Request, Response } from 'express'
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken'
import HTTP_STATUS from '~/constants/httpStatus'
import { SYSTEM_MESSAGE, USER_MESSAGE } from '~/constants/message'
import { Prisma } from '~/generated/prisma/client'
import { ApiResponse } from '~/models/ApiResponse'
import { EntityError, ErrorWithStatus } from '~/models/Errors'

export const defaultErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  try {
    // Xử lý toàn bộ lỗi do mình đủ động ném ra (throw và lỗi 422)
    if (err instanceof ErrorWithStatus) {
      const payload = err instanceof EntityError ? { errors: err.errors } : undefined
      return res.status(err.httpStatusCode).json({ success: false, message: err.message, data: payload })
    }

    if (err instanceof TokenExpiredError) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: 'Token của bạn đã hết hạn' })
    }
    if (err instanceof JsonWebTokenError) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        message: USER_MESSAGE.TOKEN_PAYLOAD_IS_INVALID
      })
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const meta = err.meta as any
      const msg =
        err.code === 'P2025'
          ? 'Không tìm thấy bản ghi trong cơ sở dữ liệu để thực hiện truy vấn'
          : meta?.driverAdapterError?.cause?.originalMessage || meta?.cause || err.message || 'Database error occurred'
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: msg,
        data: err
      })
    }

    // Nếu là lỗi không lường trước (tránh treo API)
    Object.getOwnPropertyNames(err).forEach((key) => {
      Object.defineProperty(err, key, { enumerable: true })
    })

    const { stack, ...errorInfo } = err
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: err.message || SYSTEM_MESSAGE.INTERNAL_SERVER_ERROR,
      errorInfo // Tạm để debug, tắt đi khi lên production
    })
  } catch (err) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      sucess: false,
      message: SYSTEM_MESSAGE.INTERNAL_SERVER_ERROR
    })
  }
}

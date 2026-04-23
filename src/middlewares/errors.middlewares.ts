import { NextFunction, Request, Response } from 'express'
import HTTP_STATUS from '~/constants/httpStatus'
import { SYSTEM_MESSAGE } from '~/constants/message'
import { ApiResponse } from '~/models/ApiResponse'
import { EntityError, ErrorWithStatus } from '~/models/Errors'

export const defaultErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  try {
    // Xử lý toàn bộ lỗi do mình đủ động ném ra (throw và lỗi 422)
    if (err instanceof ErrorWithStatus) {
      const payload = err instanceof EntityError ? { errors: err.errors } : undefined
      return res.status(err.httpStatusCode).json({ success: false, message: err.message, data: payload })
    }

    // Nếu là lỗi không lường trước (tránh treo API)
    Object.getOwnPropertyNames(err).forEach((key) => {
      Object.defineProperty(err, key, { enumerable: true })
    })

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: err.message || SYSTEM_MESSAGE.INTERNAL_SERVER_ERROR,
      errorInfo: err // Tạm để debug, tắt đi khi lên production
    })
  } catch (err) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      sucess: false,
      message: SYSTEM_MESSAGE.INTERNAL_SERVER_ERROR
    })
  }
}

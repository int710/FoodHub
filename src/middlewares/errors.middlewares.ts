import { NextFunction, Request, Response } from 'express'
import { SYSTEM_MESSAGE } from '~/constants/enums'
import HTTP_STATUS from '~/constants/httpStatus'
import { ApiResponse } from '~/models/ApiResponse'
import { EntityError, ErrorWithStatus } from '~/models/Errors'

export const defaultErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  try {
    // Xử lý toàn bộ lỗi do mình đủ động ném ra (throw và lỗi 422)
    if (err instanceof ErrorWithStatus) {
      const payload = err instanceof EntityError ? { errors: err.errors } : undefined
      return res.status(err.httpStatusCode).json(ApiResponse(err.message, payload))
    }
  } catch (err) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      sucess: false,
      message: SYSTEM_MESSAGE.INTERNAL_SERVER_ERROR
    })
  }
}

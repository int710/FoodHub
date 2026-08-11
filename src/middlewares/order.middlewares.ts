import { NextFunction, Request, Response } from 'express'
import HTTP_STATUS from '~/constants/httpStatus'
import { ORDER_MESSAGE } from '~/constants/message'
import { OrderType, Role } from '~/generated/prisma/enums'
import { ErrorWithStatus } from '~/models/Errors'
import { OrderContextRequest } from '~/models/types'

function normalizeOrderType(input: unknown): OrderType {
  if (typeof input !== 'string') {
    throw new ErrorWithStatus({
      httpStatusCode: HTTP_STATUS.BAD_REQUEST,
      message: ORDER_MESSAGE.INVALID_ORDER_TYPE
    })
  }

  const raw = input.trim()
  const upper = raw.toUpperCase()
  const lower = raw.toLowerCase()

  if (upper === OrderType.DINE_IN || lower === 'dine-in' || lower === 'dine_in' || lower === 'dinein') {
    return OrderType.DINE_IN
  }

  if (upper === OrderType.TAKEAWAY || lower === 'takeaway' || lower === 'take-away') {
    return OrderType.TAKEAWAY
  }

  if (upper === OrderType.DELIVERY || lower === 'delivery') {
    return OrderType.DELIVERY
  }

  throw new ErrorWithStatus({
    httpStatusCode: HTTP_STATUS.BAD_REQUEST,
    message: ORDER_MESSAGE.INVALID_ORDER_TYPE
  })
}

export const checkOrderContext = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.decoded_authorization
    const table = req.decoded_tokenTableSession
    const type = normalizeOrderType(req.params.type)
    const context: OrderContextRequest = { type }

    if (type === OrderType.DINE_IN) {
      if (!table) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: ORDER_MESSAGE.TABLE_SESSION_INVALID
        })
      }
      context.table = table
      if (user) context.user = user
    }

    if (type === OrderType.DELIVERY) {
      if (!user) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: ORDER_MESSAGE.NO_LOGIN
        })
      }

      if (user.role !== Role.ADMIN && user.role !== Role.CUSTOMER) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: ORDER_MESSAGE.CUSTOMER_ONLY_ORDER
        })
      }

      context.user = user
    }

    if (type === OrderType.TAKEAWAY) {
      if (user) {
        const isValidRole = [Role.ADMIN, Role.STAFF, Role.CUSTOMER].includes(user.role)
        if (!isValidRole) {
          throw new ErrorWithStatus({
            httpStatusCode: HTTP_STATUS.FORBIDDEN,
            message: 'Tài khoản không có quyền tạo đơn mang về'
          })
        }

        const isStaff = user.role === Role.STAFF || user.role === Role.ADMIN
        if (isStaff) {
          context.staffId = user.user_id
        } else {
          context.user = user
        }
      }
    }

    req.order_context = context
    next()
  } catch (error) {
    next(error)
  }
}
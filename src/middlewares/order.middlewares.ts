import { NextFunction, Request, Response } from 'express'
import HTTP_STATUS from '~/constants/httpStatus'
import { ORDER_MESSAGE } from '~/constants/message'
import { OrderType, Role } from '~/generated/prisma/enums'
import { ErrorWithStatus } from '~/models/Errors'
import { OrderContextRequest } from '~/models/types'

export const checkOrderContext = (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.body.type
    const user = req.decoded_authorization
    const table = req.decoded_tokenTableSession
    const context: OrderContextRequest = { type }

    if (!type || !Object.values(OrderType).includes(type)) {
      return next(
        new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.BAD_REQUEST,
          message: ORDER_MESSAGE.INVALID_ORDER_TYPE
        })
      )
    }

    // Type: DINE_IN - Quét QR có thể login hoặc guest
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

    // Type: DELIVERY - Bắt buộc login account
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

    // Type: TAKEAWAY - Mang về
    if (type === OrderType.TAKEAWAY) {
      if (!user) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: 'Khách hàng vui lòng đăng nhập hoặc nhờ nhân viên tạo đơn'
        })
      }
      const isStaff = user.role === Role.STAFF || user.role === Role.ADMIN
      const isCustomer = user.role === Role.CUSTOMER
      if (!isStaff && !isCustomer) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Tài khoản không có quyền tạo đơn mang về'
        })
      }

      if (isStaff) {
        context.staffId = user.user_id
      } else {
        context.user = user
      }
    }

    req.order_context = context
    next()
  } catch (error) {
    next(error)
  }
}

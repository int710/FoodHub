import { NextFunction, Request, Response } from 'express'
import HTTP_STATUS from '~/constants/httpStatus'
import { USER_MESSAGE } from '~/constants/message'
import { Role } from '~/generated/prisma/enums'
import { ErrorWithStatus } from '~/models/Errors'

export const requireRole = (...allowRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const uid = req.decoded_authorization?.user_id
      const role = req.decoded_authorization?.role
      if (!uid) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: USER_MESSAGE.YOU_NEED_TO_LOGIN_ACCOUNT
        })
      }
      if (!role || !allowRoles.includes(role)) {
        throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.FORBIDDEN, message: USER_MESSAGE.ACCESS_DENIED })
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}

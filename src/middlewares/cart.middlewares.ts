import { NextFunction, Request, Response } from "express";
import HTTP_STATUS from "~/constants/httpStatus";
import { OrderType, Role } from "~/generated/prisma/enums";
import { ErrorWithStatus } from "~/models/Errors";
import { CartContext } from "~/models/types";


export const resolveCartContext = (req: Request, res: Response, next: NextFunction) => {
    try {
        const typeCart = req.params.type as OrderType
        const user = req.decoded_authorization
        const table = req.decoded_tokenTableSession
        if (!Object.values(OrderType).includes(typeCart)) {
            throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.BAD_REQUEST, message: 'Loại giỏ hàng khồng hợp lệ' })
        }

        let context: CartContext
        if (typeCart === OrderType.DINE_IN) {
            if (!table) {
                throw new ErrorWithStatus({
                    httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
                    message: 'Dine-in bắt buộc cần quét QR bàn'
                })
            }
            context = {
                type: typeCart,
                ownerId: table.tableId,
                tableId: table.tableId
            }
        } else if (typeCart === OrderType.TAKEAWAY) {
            const sessionId = (req.headers['x-session-id'] as string) || user?.user_id || `guest_${req.ip || 'unknown'}`
            context = {
                type: typeCart,
                ownerId: sessionId,
                userId: user?.user_id,
                sessionId
            }
        } else {
            if (!user) {
                throw new ErrorWithStatus({
                    httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
                    message: 'Delivery bắt buộc phải đăng nhập'
                })
            }

            if (user.role !== Role.ADMIN && user.role !== Role.CUSTOMER) {
                throw new ErrorWithStatus({
                    httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
                    message: 'Tài khoản không có quyền đặt delivery'
                })
            }

            context = {
                type: typeCart,
                ownerId: user.user_id,
                userId: user.user_id
            }
        }

        req.cart_context = context
        next()
    } catch (error) {
        next(error)
    }
}

export const validateCartContext = (req: Request, res: Response, next: NextFunction) => {
    if (!req.cart_context) {
        throw new ErrorWithStatus({
            httpStatusCode: HTTP_STATUS.BAD_REQUEST,
            message: 'Không xác định được cart context'
        })
    }
    next()
}
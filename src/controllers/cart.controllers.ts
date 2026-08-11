import { Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import HTTP_STATUS from '~/constants/httpStatus'
import { OrderType } from '~/generated/prisma/enums'
import { ApiResponse } from '~/models/ApiResponse'
import { ErrorWithStatus } from '~/models/Errors'
import { CartItem, UpdateDetailItemType } from '~/models/schemas/order.schema'
import cartsServices, { CartType } from '~/services/carts.services'

type NormalizedCartContext = {
  type: CartType
  ownerId: string
  displayName: string
}

function normalizeCartType(type: string): CartType {
  if (type === OrderType.DINE_IN || type === CartType.DINE_IN) return CartType.DINE_IN
  if (type === OrderType.TAKEAWAY || type === CartType.TAKEAWAY) return CartType.TAKEAWAY
  if (type === OrderType.DELIVERY || type === CartType.DELIVERY) return CartType.DELIVERY

  throw new ErrorWithStatus({
    httpStatusCode: HTTP_STATUS.BAD_REQUEST,
    message: 'Loại giỏ hàng không hợp lệ'
  })
}

function getCartContextFromRequest(req: Request): NormalizedCartContext {
  const ctx = req.cart_context
  if (!ctx) {
    throw new ErrorWithStatus({
      httpStatusCode: HTTP_STATUS.BAD_REQUEST,
      message: 'Không có cart context, vui lòng kiểm tra middleware resolveCartContext'
    })
  }

  const ownerId = String(ctx.ownerId || '').trim()
  if (!ownerId) {
    throw new ErrorWithStatus({
      httpStatusCode: HTTP_STATUS.BAD_REQUEST,
      message: 'Thiếu ownerId của giỏ hàng'
    })
  }

  const type = normalizeCartType(String(ctx.type))
  const displayName =
    type === CartType.DINE_IN ? 'bàn' : type === CartType.TAKEAWAY ? 'mang về' : 'giao hàng'

  return { type, ownerId, displayName }
}

const cartControllers = {
  async addItem(req: Request<ParamsDictionary, any, CartItem>, res: Response) {
    const ctx = getCartContextFromRequest(req)
    const userId = req.decoded_authorization?.user_id || req.cart_context?.userId || 'Guest'

    const result = await cartsServices.addItemToCart(ctx.type, ctx.ownerId, req.body, userId)
    return res.json(ApiResponse(`Thêm sản phẩm vào giỏ ${ctx.displayName} thành công`, result))
  },

  async getCart(req: Request, res: Response) {
    const ctx = getCartContextFromRequest(req)
    const data = await cartsServices.getCart(ctx.type, ctx.ownerId)
    return res.json(ApiResponse(`Giỏ hàng ${ctx.displayName}`, data))
  },

  async updateItem(req: Request<{ itemId: string }, any, UpdateDetailItemType>, res: Response) {
    const ctx = getCartContextFromRequest(req)
    const { itemId } = req.params

    const result = await cartsServices.updateItem(ctx.type, ctx.ownerId, itemId, req.body)

    return res.json(
      ApiResponse(
        result.action === 'merged'
          ? 'Cập nhật thành công (đã gộp với món giống nhau)'
          : 'Cập nhật chi tiết sản phẩm thành công',
        result.item
      )
    )
  },

  async deleteItem(req: Request<{ itemId: string }>, res: Response) {
    const ctx = getCartContextFromRequest(req)
    const { itemId } = req.params
    await cartsServices.deleteItem(ctx.type, ctx.ownerId, itemId)
    return res.json(ApiResponse(`Đã xóa món khỏi giỏ ${ctx.displayName}`, { deleted: true }))
  },

  async clearCart(req: Request, res: Response) {
    const ctx = getCartContextFromRequest(req)
    await cartsServices.clearCart(ctx.type, ctx.ownerId)
    return res.json(ApiResponse(`Đã xóa toàn bộ giỏ ${ctx.displayName}`, { cleared: true }))
  }
}

export default cartControllers
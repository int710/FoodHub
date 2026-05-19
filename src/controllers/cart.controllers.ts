import { Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import HTTP_STATUS from '~/constants/httpStatus'
import { ApiResponse } from '~/models/ApiResponse'
import { ErrorWithStatus } from '~/models/Errors'
import { CartItem, UpdateDetailItemType } from '~/models/schemas/order.schema'
import { OrderContextRequest, TableTokenPayload } from '~/models/types'
import cartsServices from '~/services/carts.services'

const cartControllers = {
  async addItem(req: Request<ParamsDictionary, any, CartItem>, res: Response) {
    const table = req.decoded_tokenTableSession
    const user = req.decoded_authorization

    const body = req.body
    const result = await cartsServices.addItemToCart(table?.tableId as string, body, user?.user_id || 'Guest')
    return res.json(ApiResponse(`Thêm sản phẩm vào giỏ hàng bàn ${table?.name} thành công`, result))
  },

  async getCart(req: Request, res: Response) {
    const { tableId, name } = req.decoded_tokenTableSession as TableTokenPayload
    if (!tableId) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
        message: 'Bạn chưa quét QR nên không có giỏ hàng'
      })
    }
    const data = await cartsServices.getCart(tableId)
    return res.json(ApiResponse(`Giỏ hàng của bàn ${name}`, data))
  },

  async updateItem(req: Request<{ itemId: string }, any, UpdateDetailItemType>, res: Response) {
    const table = req.decoded_tokenTableSession
    if (!table || !table.tableId) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
        message: 'Bạn chưa quét QR nên không thể cập nhật giỏ hàng'
      })
    }

    const { itemId } = req.params
    const body = req.body

    const result = await cartsServices.updateItem(table.tableId, itemId, body)

    return res.json(
      ApiResponse(
        result.action === 'merged'
          ? 'Cập nhật thành công (sản phẩm đã được gộp chung với sản phẩm giống nhau)'
          : 'Cập nhật chi tiết sản phẩm thành công',
        result.item
      )
    )
  }
}
export default cartControllers

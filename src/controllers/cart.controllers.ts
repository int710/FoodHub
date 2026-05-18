import { Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { ApiResponse } from '~/models/ApiResponse'
import { CartItem } from '~/models/schemas/order.schema'
import { OrderContextRequest } from '~/models/types'
import cartsServices from '~/services/carts.services'

const cartControllers = {
  async addItem(req: Request<ParamsDictionary, any, CartItem>, res: Response) {
    const table = req.decoded_tokenTableSession
    const user = req.decoded_authorization

    const body = req.body
    const result = await cartsServices.addItemToCart(table?.tableId as string, body, user?.user_id || 'Guest')
    return res.json(ApiResponse(`Thêm sản phẩm vào giỏ hàng bàn ${table?.name} thành công`, result))
  }
}
export default cartControllers

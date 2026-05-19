import { Router } from 'express'
import cartControllers from '~/controllers/cart.controllers'
import { optionalAuth, validateTable } from '~/middlewares/auth.middlewares'
import { checkOrderContext } from '~/middlewares/order.middlewares'
import { validate } from '~/middlewares/validate'
import { cartItemsSchema, UpdateDetailSchema } from '~/models/schemas/order.schema'
import { requestHandler } from '~/utils/requestHandler'

// Cart shared dùng chung cho order của cả Table, không lưu csdl chỉ tồn tại trong redis
const cartsRouter = Router()

// Khách hàng có thể login hoặc không nhưng bắt buộc phải quét QR để sử dụng giỏ hàng chung cho cả bàn
cartsRouter.use(optionalAuth, validateTable)
cartsRouter.post('/table/items/add', validate(cartItemsSchema), requestHandler(cartControllers.addItem))
cartsRouter.get('/table/items', requestHandler(cartControllers.getCart))
cartsRouter.patch('/table/items/:itemId', validate(UpdateDetailSchema), requestHandler(cartControllers.updateItem))

export default cartsRouter

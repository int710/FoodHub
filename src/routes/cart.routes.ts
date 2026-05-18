import { Router } from 'express'
import cartControllers from '~/controllers/cart.controllers'
import { optionalAuth } from '~/middlewares/auth.middlewares'
import { checkOrderContext } from '~/middlewares/order.middlewares'
import { validate } from '~/middlewares/validate'
import { cartItemsSchema } from '~/models/schemas/order.schema'
import { requestHandler } from '~/utils/requestHandler'

// Cart shared dùng chung cho order của cả Table, không lưu csdl chỉ tồn tại trong redis
const cartsRouter = Router()

cartsRouter.post('/table/add', optionalAuth, validate(cartItemsSchema), requestHandler(cartControllers.addItem))

export default cartsRouter

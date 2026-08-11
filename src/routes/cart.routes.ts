import { Router } from 'express'
import cartControllers from '~/controllers/cart.controllers'
import { optionalAuth } from '~/middlewares/auth.middlewares'
import { resolveCartContext, validateCartContext } from '~/middlewares/cart.middlewares'
import { validate } from '~/middlewares/validate'
import { cartItemsSchema, UpdateDetailSchema } from '~/models/schemas/order.schema'
import { requestHandler } from '~/utils/requestHandler'

// Cart shared lưu trên Redis, tách theo type + ownerId
const cartsRouter = Router()

cartsRouter.use(optionalAuth)

// DINE_IN | TAKEAWAY | DELIVERY
cartsRouter.post(
    '/:type/items/add',
    resolveCartContext,
    validateCartContext,
    validate(cartItemsSchema),
    requestHandler(cartControllers.addItem)
)

cartsRouter.get(
    '/:type/items',
    resolveCartContext,
    validateCartContext,
    requestHandler(cartControllers.getCart)
)

cartsRouter.patch(
    '/:type/items/:itemId',
    resolveCartContext,
    validateCartContext,
    validate(UpdateDetailSchema),
    requestHandler(cartControllers.updateItem)
)

cartsRouter.delete(
    '/:type/items/:itemId',
    resolveCartContext,
    validateCartContext,
    requestHandler(cartControllers.deleteItem)
)

cartsRouter.delete(
    '/:type/clear',
    resolveCartContext,
    validateCartContext,
    requestHandler(cartControllers.clearCart)
)

export default cartsRouter
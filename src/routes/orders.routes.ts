import { Router } from 'express'
import { ordersController } from '~/controllers/order.controllers'
import { optionalAuth } from '~/middlewares/auth.middlewares'
import { checkOrderContext } from '~/middlewares/order.middlewares'
import { requestHandler } from '~/utils/requestHandler'

const ordersRouter = Router()

ordersRouter.post('/:type/new', optionalAuth, checkOrderContext, requestHandler(ordersController.newOrder))

export default ordersRouter
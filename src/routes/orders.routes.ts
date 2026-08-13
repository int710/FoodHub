import { Router } from 'express'
import { ordersController } from '~/controllers/order.controllers'
import { Role } from '~/generated/prisma/enums'
import { authenticate, optionalAuth } from '~/middlewares/auth.middlewares'
import { checkOrderContext } from '~/middlewares/order.middlewares'
import { requireRole } from '~/middlewares/rbac.middlewares'
import { validate } from '~/middlewares/validate'
import { kitchenOrdersQuerySchema, orderHistoryQuerySchema } from '~/models/schemas/order.schema'
import { requestHandler } from '~/utils/requestHandler'
import {
    cancelOrderSchema,
    confirmOrderSchema,
    rejectOrderSchema,
    serveOrderSchema,
    updateKitchenItemStatusSchema
} from '~/models/schemas/order.schema'

const ordersRouter = Router()


ordersRouter.post('/:type/new', optionalAuth, checkOrderContext, requestHandler(ordersController.newOrder))

ordersRouter.get('/history', authenticate, validate(orderHistoryQuerySchema), requestHandler(ordersController.history))

ordersRouter.get('/kitchen', authenticate, requireRole(Role.STAFF, Role.ADMIN), validate(kitchenOrdersQuerySchema), requestHandler(ordersController.getKitchenOrders))

ordersRouter.patch('/kitchen/:itemId/status', authenticate, requireRole(Role.STAFF, Role.ADMIN), validate(updateKitchenItemStatusSchema), requestHandler(ordersController.updateKitchenStatus))

ordersRouter.patch('/:id/confirm', authenticate, requireRole(Role.STAFF, Role.ADMIN), validate(confirmOrderSchema), requestHandler(ordersController.confirm))

ordersRouter.patch('/:id/reject', authenticate, requireRole(Role.STAFF, Role.ADMIN), validate(rejectOrderSchema), requestHandler(ordersController.reject))

ordersRouter.patch('/:id/serve', authenticate, requireRole(Role.STAFF, Role.ADMIN), validate(serveOrderSchema), requestHandler(ordersController.serve))

ordersRouter.patch('/:id/cancel', authenticate, validate(cancelOrderSchema), requestHandler(ordersController.cancel))


export default ordersRouter
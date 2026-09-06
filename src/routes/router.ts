import { Router } from 'express'
import usersRouter from './users.routes'
import tablesRouter from './tables.routes'
import menusRouter from './menu.routes'
import mediasRouter from './media.routes'
import ordersRouter from './orders.routes'
import cartsRouter from './cart.routes'
import paymentsRouter from './payment.routes'
import reviewRouter from './review.routes'
import notificationRouter from './notification.routes'

const routerApp = Router()

routerApp.use('/user', usersRouter)
routerApp.use('/table', tablesRouter)
routerApp.use('/menu', menusRouter)
routerApp.use('/media', mediasRouter)
routerApp.use('/order', ordersRouter)
routerApp.use('/cart', cartsRouter)
routerApp.use('/payment', paymentsRouter)
routerApp.use('/reviews', reviewRouter)
routerApp.use('/notifications', notificationRouter)

export default routerApp

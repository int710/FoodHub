import { Router } from 'express'
import usersRouter from './users.routes'
import tablesRouter from './tables.routes'
import menusRouter from './menu.routes'
import mediasRouter from './media.routes'
import ordersRouter from './orders.routes'
import cartsRouter from './cart.routes'

const routerApp = Router()

routerApp.use('/user', usersRouter)
routerApp.use('/table', tablesRouter)
routerApp.use('/menu', menusRouter)
routerApp.use('/media', mediasRouter)
routerApp.use('/order', ordersRouter)
routerApp.use('/cart', cartsRouter)

export default routerApp

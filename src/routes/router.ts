import { Router } from 'express'
import usersRouter from './users.routes'
import tablesRouter from './tables.routes'
import menusRouter from './menu.routes'

const routerApp = Router()

routerApp.use('/user', usersRouter)
routerApp.use('/table', tablesRouter)
routerApp.use('/menu', menusRouter)

export default routerApp

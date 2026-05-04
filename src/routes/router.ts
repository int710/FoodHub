import { Router } from 'express'
import usersRouter from './users.routes'
import tablesRouter from './tables.routes'

const routerApp = Router()

routerApp.use('/user', usersRouter)
routerApp.use('/table', tablesRouter)

export default routerApp

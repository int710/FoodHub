import { Router } from 'express'
import usersRouter from './users.routes'

const routerApp = Router()

routerApp.use('/user', usersRouter)

export default routerApp

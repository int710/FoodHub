import { Router } from 'express'
import { registerController } from '~/controllers/users.controllers'

const usersRouter = Router()

usersRouter.get('/register', registerController)

export default usersRouter

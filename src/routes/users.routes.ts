import { Router } from 'express'
import { registerController } from '~/controllers/users.controllers'
import { validate } from '~/middlewares/validate'
import { registerReqSchema } from '~/models/schemas/users.schema'

const usersRouter = Router()

usersRouter.post('/register', validate(registerReqSchema), registerController)

export default usersRouter

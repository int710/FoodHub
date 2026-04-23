import { Router } from 'express'
import { loginController, registerController } from '~/controllers/users.controllers'
import { validate } from '~/middlewares/validate'
import { loginReqBody, registerReqSchema } from '~/models/schemas/users.schema'
import { requestHandler } from '~/utils/requestHandler'

const usersRouter = Router()

usersRouter.post('/register', validate(registerReqSchema), requestHandler(registerController))
usersRouter.post('/login', validate(loginReqBody), requestHandler(loginController))

export default usersRouter

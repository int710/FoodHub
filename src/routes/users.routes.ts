import { Router } from 'express'
import {
  getMeController,
  loginController,
  logoutController,
  refreshTokenController,
  registerController
} from '~/controllers/users.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { validate } from '~/middlewares/validate'
import { loginReqBody, logoutReqBody, registerReqSchema } from '~/models/schemas/users.schema'
import { requestHandler } from '~/utils/requestHandler'

const usersRouter = Router()

usersRouter.post('/register', validate(registerReqSchema), requestHandler(registerController))
usersRouter.post('/login', validate(loginReqBody), requestHandler(loginController))
usersRouter.post('/logout', validate(logoutReqBody), requestHandler(logoutController))
usersRouter.post('/refresh-token', requestHandler(refreshTokenController))
usersRouter.get('/me', authenticate, requestHandler(getMeController))

export default usersRouter

import { Router } from 'express'
import {
  getMeController,
  loginController,
  logoutController,
  refreshTokenController,
  registerController,
  verifyEmailController
} from '~/controllers/users.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { validate } from '~/middlewares/validate'
import { loginReqBody, logoutReqBody, registerReqSchema, verifyEmailReq } from '~/models/schemas/users.schema'
import { requestHandler } from '~/utils/requestHandler'

const usersRouter = Router()

usersRouter.post('/register', validate(registerReqSchema), requestHandler(registerController))
usersRouter.post('/login', validate(loginReqBody), requestHandler(loginController))
usersRouter.post('/logout', validate(logoutReqBody), requestHandler(logoutController))
usersRouter.post('/refresh-token', requestHandler(refreshTokenController))
usersRouter.get('/me', authenticate, requestHandler(getMeController))
usersRouter.post('/verify-email', validate(verifyEmailReq), requestHandler(verifyEmailController))

export default usersRouter

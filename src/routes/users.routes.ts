import { Router } from 'express'
import {
  forgotPasswordController,
  getMeController,
  loginController,
  logoutController,
  refreshTokenController,
  registerController,
  resetPasswordController,
  verifyEmailController
} from '~/controllers/users.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { validate } from '~/middlewares/validate'
import {
  emailReq,
  loginReqBody,
  logoutReqBody,
  registerReqSchema,
  resetPasswordReq,
  verifyEmailReq
} from '~/models/schemas/users.schema'
import { requestHandler } from '~/utils/requestHandler'

const usersRouter = Router()

usersRouter.post('/register', validate(registerReqSchema), requestHandler(registerController))
usersRouter.post('/login', validate(loginReqBody), requestHandler(loginController))
usersRouter.post('/logout', validate(logoutReqBody), requestHandler(logoutController))
usersRouter.post('/refresh-token', requestHandler(refreshTokenController))
usersRouter.get('/me', authenticate, requestHandler(getMeController))
usersRouter.post('/verify-email', validate(verifyEmailReq), requestHandler(verifyEmailController))
usersRouter.post('/forgot-password', validate(emailReq), requestHandler(forgotPasswordController))
usersRouter.post('/reset-password', validate(resetPasswordReq), requestHandler(resetPasswordController))

export default usersRouter

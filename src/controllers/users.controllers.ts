import { NextFunction, Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import HTTP_STATUS from '~/constants/httpStatus'
import { USER_MESSAGE } from '~/constants/message'
import { ApiResponse } from '~/models/ApiResponse'
import { ErrorWithStatus } from '~/models/Errors'
import { TokenPayload } from '~/models/schemas/token.schema'
import {
  EmailReqBody,
  LoginReqBody,
  LogoutReqBody,
  RefreshTokenReq,
  RegisterRequestBody,
  ResetPasswordReq,
  VerifyEmailReq
} from '~/models/schemas/users.schema'
import userServices from '~/services/users.services'

export const registerController = async (
  req: Request<ParamsDictionary, any, RegisterRequestBody>,
  res: Response,
  next: NextFunction
) => {
  const clientIP = req.ip as string
  const userAgent = req.headers['user-agent'] as string
  const data = await userServices.register(req.body, clientIP, userAgent)
  res.json(ApiResponse(USER_MESSAGE.REGISTER_SUCCESSFULLY, data))
}

export const loginController = async (
  req: Request<ParamsDictionary, any, LoginReqBody>,
  res: Response,
  next: NextFunction
) => {
  const { email, password } = req.body
  const data = await userServices.login(email, password, req)
  return res.json(ApiResponse(USER_MESSAGE.LOGIN_SUCCESS, data))
}

export const logoutController = async (
  req: Request<ParamsDictionary, any, LogoutReqBody>,
  res: Response,
  next: NextFunction
) => {
  const result = await userServices.logout(req.body.refresh_token)
  return res.json(ApiResponse('Logout success', null))
}

export const refreshTokenController = async (
  req: Request<ParamsDictionary, any, RefreshTokenReq>,
  res: Response,
  next: NextFunction
) => {
  const { refresh_token } = req.body
  if (!refresh_token) {
    throw new ErrorWithStatus({
      httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
      message: USER_MESSAGE.REFRESH_TOKEN_IS_REQUIRED
    })
  }
  const result = await userServices.refreshToken(refresh_token, req)
  return res.json(ApiResponse(USER_MESSAGE.REFRESH_TOKEN_SUCCESSFULLY, result))
}

export const getMeController = async (req: Request, res: Response, next: NextFunction) => {
  const { user_id } = req.decoded_authorization as TokenPayload
  const user = await userServices.getProfile(user_id)
  return res.json(ApiResponse(USER_MESSAGE.GET_MY_PROFILE_SUCCESS, user))
}

export const verifyEmailController = async (
  req: Request<ParamsDictionary, any, VerifyEmailReq>,
  res: Response,
  next: NextFunction
) => {
  const { verify_email_token } = req.body
  const result = await userServices.verifyEmail(verify_email_token)
  return res.json(ApiResponse(result, null))
}

export const forgotPasswordController = async (
  req: Request<ParamsDictionary, any, EmailReqBody>,
  res: Response,
  next: NextFunction
) => {
  const { email } = req.body
  const result = await userServices.forgotPassword(email)
  return res.json(ApiResponse(result, null))
}

export const resetPasswordController = async (
  req: Request<ParamsDictionary, any, ResetPasswordReq>,
  res: Response,
  next: NextFunction
) => {
  const { forgot_password_token, new_password } = req.body
  const result = await userServices.resetPassword(forgot_password_token, new_password)
  return res.json(ApiResponse(result, null))
}

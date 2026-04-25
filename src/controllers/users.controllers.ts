import { NextFunction, Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import HTTP_STATUS from '~/constants/httpStatus'
import { USER_MESSAGE } from '~/constants/message'
import { ApiResponse } from '~/models/ApiResponse'
import { ErrorWithStatus } from '~/models/Errors'
import { LoginReqBody, LogoutReqBody, RefreshTokenReq, RegisterRequestBody } from '~/models/schemas/users.schema'
import userServices from '~/services/users.services'

export const registerController = async (
  req: Request<ParamsDictionary, any, RegisterRequestBody>,
  res: Response,
  next: NextFunction
) => {
  const data = await userServices.register(req.body)
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

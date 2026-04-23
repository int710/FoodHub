import { NextFunction, Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { USER_MESSAGE } from '~/constants/message'
import { ApiResponse } from '~/models/ApiResponse'
import { LoginReqBody, RegisterRequestBody } from '~/models/schemas/users.schema'
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

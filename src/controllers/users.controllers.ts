import { NextFunction, Request, Response } from 'express'
import { ApiResponse } from '~/models/ApiResponse'

export const registerController = (req: Request, res: Response, next: NextFunction) => {
  // throw Error('lỗi')
  res.json(ApiResponse('success register', { user: 1 }))
}

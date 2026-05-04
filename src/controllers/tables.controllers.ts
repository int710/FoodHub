import { NextFunction, Request, Response } from 'express'
import { TableReqBody } from '~/models/schemas/table.schema'
import { ParamsDictionary } from 'express-serve-static-core'
import { ApiResponse } from '~/models/ApiResponse'
import tableServices from '~/services/tables.services'
import { TABLE_MESSAGE } from '~/constants/message'

export const createTableController = async (
  req: Request<ParamsDictionary, any, TableReqBody>,
  res: Response,
  next: NextFunction
) => {
  const result = await tableServices.createNewTable(req.body)
  return res.json(ApiResponse(TABLE_MESSAGE.CREATE_NEW_TABLE_SUCCESS, result))
}

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

export const getTableByIdController = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  const { id } = req.params
  const result = await tableServices.getTableById(id)
  return res.json(ApiResponse(TABLE_MESSAGE.GET_DETAIL_TABLE_SUCCESS, result))
}

export const getQRController = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  const { id } = req.params
  const result = await tableServices.getQR(id)
  return res.json(ApiResponse(TABLE_MESSAGE.GET_QRCODE_SUCCESS, result))
}

export const regenerateQRController = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  const { id } = req.params
  const result = await tableServices.regenerateQR(id)
  return res.json(ApiResponse(TABLE_MESSAGE.REGENERATE_QRCODE_TABLE_SUCCESS, result))
}

export const toggleController = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  const result = await tableServices.toggleTable(req.params.id)
  const msg = result.isActive ? 'Bàn đã mở lại' : 'Bàn đã tạm ngưng (bảo trì)'
  return res.json(ApiResponse(msg, result))
}

export const qrScanController = async (
  req: Request<ParamsDictionary, any, { qrToken: string }>,
  res: Response,
  next: NextFunction
) => {
  const { qrToken } = req.body
  const data = await tableServices.scanQR(qrToken)
  if (data.occupied) {
    return res.json(ApiResponse(data.message, data))
  } else {
    return res.json(ApiResponse(TABLE_MESSAGE.SCAN_QRCODE_SUCCESS, data))
  }
}

import { Request, Response } from 'express'
import { ApiResponse } from '~/models/ApiResponse'
import { UpdateSystemSettingDto } from '~/models/schemas/system-setting.schema'
import systemSettingsServices from '~/services/system-settings.services'

export const getPublicSystemSetting = async (_req: Request, res: Response) => {
  const setting = await systemSettingsServices.get()
  return res.json(ApiResponse('Lấy cấu hình ứng dụng thành công', setting))
}

export const updateSystemSetting = async (req: Request<any, any, UpdateSystemSettingDto>, res: Response) => {
  const setting = await systemSettingsServices.update(req.body)
  return res.json(ApiResponse('Cập nhật cấu hình hệ thống thành công', setting))
}

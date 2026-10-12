import { Router } from 'express'
import { getPublicSystemSetting, updateSystemSetting } from '~/controllers/system-settings.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { requireRole } from '~/middlewares/rbac.middlewares'
import { validate } from '~/middlewares/validate'
import { updateSystemSettingSchema } from '~/models/schemas/system-setting.schema'
import { requestHandler } from '~/utils/requestHandler'

const systemSettingsRouter = Router()

systemSettingsRouter.get('/', requestHandler(getPublicSystemSetting))
systemSettingsRouter.patch(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate(updateSystemSettingSchema),
  requestHandler(updateSystemSetting)
)

export default systemSettingsRouter

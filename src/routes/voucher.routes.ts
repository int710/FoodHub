import { Router } from 'express'
import { voucherController } from '~/controllers/voucher.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { requireRole } from '~/middlewares/rbac.middlewares'
import { validate } from '~/middlewares/validate'
import { createVoucherSchema, updateVoucherSchema } from '~/models/schemas/voucher.schema'
import { requestHandler } from '~/utils/requestHandler'

const voucherRouter = Router()
voucherRouter.get('/available', requestHandler(voucherController.listAvailable))
voucherRouter.get('/my', authenticate, requireRole('CUSTOMER'), requestHandler(voucherController.listMine))
voucherRouter.get('/admin', authenticate, requireRole('ADMIN'), requestHandler(voucherController.listAdmin))
voucherRouter.post('/admin', authenticate, requireRole('ADMIN'), validate(createVoucherSchema), requestHandler(voucherController.create))
voucherRouter.patch('/admin/:id', authenticate, requireRole('ADMIN'), validate(updateVoucherSchema), requestHandler(voucherController.update))
voucherRouter.delete('/admin/:id', authenticate, requireRole('ADMIN'), requestHandler(voucherController.delete))
export default voucherRouter

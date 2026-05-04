import { Router } from 'express'
import {
  createTableController,
  getQRController,
  getTableByIdController,
  regenerateQRController,
  toggleController
} from '~/controllers/tables.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { requireRole } from '~/middlewares/rbac.middlewares'
import { requestHandler } from '~/utils/requestHandler'

const tablesRouter = Router()

tablesRouter.get('/:id', requestHandler(getTableByIdController))
tablesRouter.post('/new', authenticate, requireRole('ADMIN'), requestHandler(createTableController))
tablesRouter.get('/:id/qr', authenticate, requireRole('ADMIN'), requestHandler(getQRController))
tablesRouter.post('/:id/regenerate-qr', authenticate, requireRole('ADMIN'), requestHandler(regenerateQRController))
tablesRouter.patch('/:id/toggle', authenticate, requireRole('ADMIN'), requestHandler(toggleController))

export default tablesRouter

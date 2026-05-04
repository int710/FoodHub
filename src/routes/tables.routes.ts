import { Router } from 'express'
import { createTableController } from '~/controllers/tables.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { requireRole } from '~/middlewares/rbac.middlewares'
import { requestHandler } from '~/utils/requestHandler'

const tablesRouter = Router()

tablesRouter.post('/new', authenticate, requireRole('ADMIN'), requestHandler(createTableController))

export default tablesRouter

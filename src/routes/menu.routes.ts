import { Router } from 'express'
import { menusController } from '~/controllers/menu.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { requireRole } from '~/middlewares/rbac.middlewares'
import { validate } from '~/middlewares/validate'
import { menuRequestBody } from '~/models/schemas/menu.schema'
import { requestHandler } from '~/utils/requestHandler'

const menusRouter = Router()

menusRouter.post(
  '/categories',
  authenticate,
  requireRole('ADMIN'),
  validate(menuRequestBody),
  requestHandler(menusController.createCategory)
)
menusRouter.get('/categories', requestHandler(menusController.getAllCategory))
menusRouter.put(
  '/categories/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(menuRequestBody),
  requestHandler(menusController.updateCategory)
)
menusRouter.delete(
  '/categories/:id',
  authenticate,
  requireRole('ADMIN'),
  requestHandler(menusController.deleteCategory)
)
export default menusRouter

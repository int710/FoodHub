import { Router } from 'express'
import { menusController } from '~/controllers/menu.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { requireRole } from '~/middlewares/rbac.middlewares'
import { validate } from '~/middlewares/validate'
import { createMenuItemBody, getItemsQuery, menuRequestBody, updateMenuItemSchema } from '~/models/schemas/menu.schema'
import { requestHandler } from '~/utils/requestHandler'

const menusRouter = Router()

menusRouter.get('/categories', requestHandler(menusController.getAllCategory))
menusRouter.post(
  '/categories',
  authenticate,
  requireRole('ADMIN'),
  validate(menuRequestBody),
  requestHandler(menusController.createCategory)
)
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
menusRouter.post(
  '/items',
  authenticate,
  requireRole('ADMIN'),
  validate(createMenuItemBody),
  requestHandler(menusController.createMenuItem)
)
menusRouter.patch(
  '/items/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(updateMenuItemSchema),
  requestHandler(menusController.updateMenuItem)
)

menusRouter.get(
  '/items',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  validate(getItemsQuery),
  requestHandler(menusController.getAllItems)
)

menusRouter.patch(
  '/items/:id/toggle',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  requestHandler(menusController.toggleItem)
)

menusRouter.delete('/items/:id', authenticate, requireRole('ADMIN'), requestHandler(menusController.deleteItem))

export default menusRouter

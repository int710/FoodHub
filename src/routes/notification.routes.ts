import { Router } from 'express'
import { notificationController } from '~/controllers/notification.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { validate } from '~/middlewares/validate'
import {
  notificationIdParamsSchema,
  notificationQuerySchema
} from '~/models/schemas/notification.schema'
import { requestHandler } from '~/utils/requestHandler'

const notificationRouter = Router()

notificationRouter.get(
  '/',
  authenticate,
  validate(notificationQuerySchema),
  requestHandler(notificationController.list)
)
notificationRouter.get('/unread-count', authenticate, requestHandler(notificationController.unreadCount))
notificationRouter.patch('/read-all', authenticate, requestHandler(notificationController.markAllAsRead))
notificationRouter.patch(
  '/:id/read',
  authenticate,
  validate(notificationIdParamsSchema),
  requestHandler(notificationController.markAsRead)
)

export default notificationRouter
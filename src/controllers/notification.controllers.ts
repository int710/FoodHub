import { Request, Response } from 'express'
import HTTP_STATUS from '~/constants/httpStatus'
import { ApiResponse } from '~/models/ApiResponse'
import { ErrorWithStatus } from '~/models/Errors'
import {
  notificationIdParamsSchema,
  notificationQuerySchema
} from '~/models/schemas/notification.schema'
import notificationsServices from '~/services/notifications.services'

export const notificationController = {
  async list(req: Request, res: Response) {
    const userId = req.decoded_authorization!.user_id
    const { query } = notificationQuerySchema.parse({ query: req.query })
    const result = await notificationsServices.list(
      userId,
      query.page,
      query.limit,
      query.unreadOnly
    )

    return res.json(ApiResponse('Danh sách thông báo', result.notifications, result.pagination))
  },

  async unreadCount(req: Request, res: Response) {
    const count = await notificationsServices.countUnread(req.decoded_authorization!.user_id)
    return res.json(ApiResponse('Số thông báo chưa đọc', { count }))
  },

  async markAsRead(req: Request, res: Response) {
    const { id } = notificationIdParamsSchema.parse({ params: req.params })
    const notification = await notificationsServices.markAsRead(
      req.decoded_authorization!.user_id,
      id
    )

    if (!notification) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy thông báo'
      })
    }

    return res.json(ApiResponse('Đã đánh dấu thông báo là đã đọc', notification))
  },

  async markAllAsRead(req: Request, res: Response) {
    const result = await notificationsServices.markAllAsRead(req.decoded_authorization!.user_id)
    return res.json(ApiResponse('Đã đánh dấu tất cả thông báo là đã đọc', {
      modifiedCount: result.modifiedCount
    }))
  }
}
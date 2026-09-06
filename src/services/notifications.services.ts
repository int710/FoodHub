import { prisma } from '~/config/prisma'
import { Role, OrderStatus } from '~/generated/prisma/enums'
import {
  NotificationModel,
  NotificationRecipientRole,
  NotificationType
} from '~/models/mongodb/notification.model'

type NotificationMetadata = Record<string, unknown>

type CreateNotificationInput = {
  recipientId: string
  recipientRole: NotificationRecipientRole
  type: NotificationType
  title: string
  message: string
  orderId?: string
  orderCode?: string
  metadata?: NotificationMetadata
  dedupeKey: string
}

const roleToNotificationRole = (role: Role): NotificationRecipientRole => {
  return role === Role.CUSTOMER
    ? NotificationRecipientRole.CUSTOMER
    : role === Role.ADMIN
      ? NotificationRecipientRole.ADMIN
      : NotificationRecipientRole.STAFF
}

class NotificationsServices {
  async create(input: CreateNotificationInput) {
    return NotificationModel.findOneAndUpdate(
      { recipientId: input.recipientId, dedupeKey: input.dedupeKey },
      { $setOnInsert: input },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean()
  }

  private async createForHosts(input: Omit<CreateNotificationInput, 'recipientId' | 'recipientRole'>) {
    const hosts = await prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.STAFF] }, isActive: true },
      select: { id: true, role: true }
    })

    await Promise.all(hosts.map((host) => this.create({
      ...input,
      recipientId: host.id,
      recipientRole: roleToNotificationRole(host.role)
    })))
  }

  async createOrderCreated(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderCode: true, type: true }
    })
    if (!order) return

    await this.createForHosts({
      type: NotificationType.ORDER_CREATED,
      title: 'Có đơn hàng mới',
      message: `Đơn ${order.orderCode} đang chờ xử lý.`,
      orderId: order.id,
      orderCode: order.orderCode,
      dedupeKey: `order:${order.id}:created`
    })
  }

  async createOrderStatusNotification({
    orderId,
    previousStatus,
    status,
    actorRole,
    reason
  }: {
    orderId: string
    previousStatus?: OrderStatus
    status: OrderStatus
    actorRole?: Role
    reason?: string
  }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderCode: true, customerId: true }
    })
    if (!order) return

    let type: NotificationType | undefined
    let title = ''
    let message = ''

    if (status === OrderStatus.PENDING_CONFIRMATION && previousStatus === OrderStatus.PENDING_PAYMENT) {
      type = NotificationType.ORDER_PAYMENT_SUCCESS
      title = 'Thanh toán thành công'
      message = `Thanh toán cho đơn ${order.orderCode} đã được ghi nhận.`
    } else if (status === OrderStatus.PAYMENT_FAILED) {
      type = NotificationType.ORDER_PAYMENT_FAILED
      title = 'Thanh toán thất bại'
      message = `Thanh toán cho đơn ${order.orderCode} không thành công.`
    } else if (status === OrderStatus.CONFIRMED) {
      type = NotificationType.ORDER_CONFIRMED
      title = 'Đơn hàng đã được xác nhận'
      message = `Đơn ${order.orderCode} đã được quán xác nhận.`
    } else if (status === OrderStatus.PREPARING) {
      type = NotificationType.ORDER_PREPARING
      title = 'Đơn hàng đang được chuẩn bị'
      message = `Quán đang chuẩn bị đơn ${order.orderCode}.`
    } else if (status === OrderStatus.READY) {
      type = NotificationType.ORDER_READY
      title = 'Đơn hàng đã sẵn sàng'
      message = `Đơn ${order.orderCode} đã sẵn sàng.`
    } else if (status === OrderStatus.SERVED) {
      type = NotificationType.ORDER_SERVED
      title = 'Đơn hàng đã được phục vụ'
      message = `Đơn ${order.orderCode} đã được phục vụ.`
    } else if (status === OrderStatus.COMPLETED) {
      type = NotificationType.ORDER_COMPLETED
      title = 'Đơn hàng đã hoàn thành'
      message = `Đơn ${order.orderCode} đã hoàn thành.`
    } else if (status === OrderStatus.CANCELLED) {
      type = NotificationType.ORDER_CANCELLED
      title = 'Đơn hàng đã bị hủy'
      message = `Đơn ${order.orderCode} đã bị hủy.`
    }

    if (!type) return

    const input = {
      type,
      title,
      message,
      orderId: order.id,
      orderCode: order.orderCode,
      metadata: reason ? { reason } : undefined,
      dedupeKey: `order:${order.id}:notification:${type}`
    }

    if (status === OrderStatus.CANCELLED && actorRole === Role.CUSTOMER) {
      await this.createForHosts(input)
      return
    }

    if (!order.customerId) return
    await this.create({
      ...input,
      recipientId: order.customerId,
      recipientRole: NotificationRecipientRole.CUSTOMER
    })
  }

  async list(recipientId: string, page: number, limit: number, unreadOnly: boolean) {
    const filter = { recipientId, ...(unreadOnly ? { readAt: null } : {}) }
    const [notifications, total] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      NotificationModel.countDocuments(filter)
    ])
    return { notifications, pagination: { page, limit, total } }
  }

  countUnread(recipientId: string) {
    return NotificationModel.countDocuments({ recipientId, readAt: null })
  }

  async markAsRead(recipientId: string, notificationId: string) {
    return NotificationModel.findOneAndUpdate(
      { _id: notificationId, recipientId },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean()
  }

  markAllAsRead(recipientId: string) {
    return NotificationModel.updateMany(
      { recipientId, readAt: null },
      { $set: { readAt: new Date() } }
    )
  }
}

export default new NotificationsServices()
import { prisma } from "~/config/prisma"
import { ItemStatus, OrderStatus, Role } from "~/generated/prisma/enums"
import { HistoryQuery, KitchenQuery } from "~/models/schemas/order.schema"
import HTTP_STATUS from '~/constants/httpStatus'
import { ErrorWithStatus } from '~/models/Errors'
import { PaymentStatus } from '~/generated/prisma/enums'

const orderDetailInclude = {
  table: {
    select: { id: true, name: true, floor: true }
  },
  customer: {
    select: { id: true, name: true, email: true, phone: true }
  },
  confirmedBy: {
    select: { id: true, name: true, email: true }
  },
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      menuItem: {
        select: { id: true, name: true, image: true }
      }
    }
  },
  payments: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      txnRef: true,
      paidAt: true,
      createdAt: true
    }
  }
}


class OrdersServices {
  async getHistory(actorId: string, actorRole: Role, query: HistoryQuery) {
    const { limit, page, customerId, from, status, tableId, to, type } = query
    const skip = (page - 1) * limit

    // customer chỉ được xem order của họ
    // staff và admin xem tất cả
    const where = {
      ...(actorRole === Role.CUSTOMER ? { customerId: actorId } : {}),
      ...(actorRole === Role.ADMIN && customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(tableId ? { tableId } : {}),
      ...(from || to
        ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {})
          }
        }
        : {})
    }

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: orderDetailInclude
      }),
      prisma.order.count({ where })
    ])

    return {
      orders,
      pagination: { page, limit, total }
    }
  }

  async getKitchenOrders(query: KitchenQuery) {
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit
    const itemStatus = query.status ? [query.status] : [ItemStatus.WAITING, ItemStatus.PREPARING]

    const where = {
      status: { in: itemStatus },
      order: {
        is: {
          status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING] }
        }
      }
    }

    const [items, total] = await prisma.$transaction([
      prisma.orderItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          orderId: true,
          quantity: true,
          note: true,
          snapshot: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          order: {
            select: {
              id: true,
              type: true,
              status: true,
              note: true,
              pickupCode: true,
              createdAt: true,
              table: {
                select: { id: true, name: true, floor: true }
              }
            }
          }
        }
      }),
      prisma.orderItem.count({ where })
    ])

    return {
      items,
      pagination: { page, limit, total }
    }
  }
  async confirmOrder(orderId: string, staffId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true }
    })

    if (!order) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy đơn hàng'
      })
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Chỉ có thể xác nhận đơn đang chờ'
      })
    }

    return prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CONFIRMED,
        confirmedById: staffId,
        confirmAt: new Date()
      },
      include: orderDetailInclude
    })
  }

  async rejectOrder(orderId: string, reason: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          select: { status: true }
        }
      }
    })

    if (!order) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy đơn hàng'
      })
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Chỉ có thể từ chối đơn đang chờ'
      })
    }

    if (order.payments.some((payment) => payment.status === PaymentStatus.SUCCESS)) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.CONFLICT,
        message: 'Đơn đã thanh toán, cần xử lý hoàn tiền trước khi từ chối'
      })
    }

    return prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason: reason
      },
      include: orderDetailInclude
    })
  }

  async updateKitchenItemStatus(itemId: string, status: ItemStatus) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          orderId: true,
          status: true,
          order: {
            select: {
              status: true
            }
          }
        }
      })

      if (!item) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy món trong đơn'
        })
      }

      if (
        item.order.status !== OrderStatus.CONFIRMED &&
        item.order.status !== OrderStatus.PREPARING
      ) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Đơn không ở trạng thái có thể chế biến'
        })
      }

      if (item.status === ItemStatus.READY) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Món này đã hoàn thành'
        })
      }

      const updatedItem = await tx.orderItem.update({
        where: { id: itemId },
        data: { status },
        include: {
          menuItem: {
            select: { id: true, name: true, image: true }
          }
        }
      })

      if (status === ItemStatus.PREPARING) {
        await tx.order.update({
          where: { id: item.orderId },
          data: { status: OrderStatus.PREPARING }
        })
      }

      if (status === ItemStatus.READY) {
        const unfinishedCount = await tx.orderItem.count({
          where: {
            orderId: item.orderId,
            status: { not: ItemStatus.READY }
          }
        })

        if (unfinishedCount === 0) {
          await tx.order.update({
            where: { id: item.orderId },
            data: {
              status: OrderStatus.READY,
              readyAt: new Date()
            }
          })
        }
      }

      return updatedItem
    })
  }

  async serveOrder(orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          items: {
            select: { status: true }
          }
        }
      })

      if (!order) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy đơn hàng'
        })
      }

      if (order.status !== OrderStatus.READY) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Chỉ có thể phục vụ đơn đã hoàn thành'
        })
      }

      if (order.items.some((item) => item.status !== ItemStatus.READY)) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Vẫn còn món chưa hoàn thành'
        })
      }

      await tx.orderItem.updateMany({
        where: { orderId },
        data: { status: ItemStatus.SERVED }
      })

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.SERVED,
          servedAt: new Date()
        },
        include: orderDetailInclude
      })
    })
  }

  async cancelOrder(orderId: string, actorId: string, actorRole: Role, reason: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          select: { status: true }
        }
      }
    })

    if (!order) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy đơn hàng'
      })
    }

    // Customer chỉ hủy đơn của mình.
    if (actorRole === Role.CUSTOMER && order.customerId !== actorId) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Bạn không có quyền hủy đơn này'
      })
    }

    // Customer chỉ được hủy trước khi staff xác nhận.
    const allowedStatuses =
      actorRole === Role.CUSTOMER
        ? [OrderStatus.PENDING]
        : [OrderStatus.PENDING, OrderStatus.CONFIRMED]

    const canCancel =
      actorRole === Role.CUSTOMER
        ? order.status === OrderStatus.PENDING
        : order.status === OrderStatus.PENDING ||
        order.status === OrderStatus.CONFIRMED

    if (!canCancel) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Đơn hiện không thể hủy'
      })
    }

    if (order.payments.some((payment) => payment.status === PaymentStatus.SUCCESS)) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.CONFLICT,
        message: 'Đơn đã thanh toán, cần xử lý hoàn tiền trước khi hủy'
      })
    }

    return prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason: reason
      },
      include: orderDetailInclude
    })
  }
}

const ordersServices = new OrdersServices()
export default ordersServices
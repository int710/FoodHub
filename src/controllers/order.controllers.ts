import { Request, Response } from 'express'
import { prisma } from '~/config/prisma'
import HTTP_STATUS from '~/constants/httpStatus'
import { Prisma } from '~/generated/prisma/client'
import { ItemStatus, OrderStatus, OrderType, PaymentMethod, PaymentStatus, Role } from '~/generated/prisma/enums'
import { ApiResponse } from '~/models/ApiResponse'
import { ErrorWithStatus } from '~/models/Errors'
import { HistoryQuery, kitchenOrdersQuerySchema, KitchenQuery } from '~/models/schemas/order.schema'
import { VNPay } from 'vnpay'
import { ProductCode, VnpLocale } from 'vnpay/enums'
import { dateFormat } from 'vnpay/utils'
import cartsServices, { CartType } from '~/services/carts.services'
import ordersServices from '~/services/orders.services'
import { orderHistoryQuerySchema } from '~/models/schemas/order.schema'
import { ParamsDictionary } from 'express-serve-static-core'
import {
  cancelOrderSchema,
  confirmOrderSchema,
  rejectOrderSchema,
  serveOrderSchema,
  updateKitchenItemStatusSchema
} from '~/models/schemas/order.schema'
import { vnpay } from '~/config/vnpay'
import { emitOrderItemStatusUpdate, emitOrderStatusUpdate } from '~/socket/orders/order.emitter'
import { TokenPayload } from '~/models/schemas/token.schema'
import notificationsServices from '~/services/notifications.services'

function mapOrderTypeToCartType(type: OrderType): CartType {
  if (type === OrderType.DINE_IN) return CartType.DINE_IN
  if (type === OrderType.TAKEAWAY) return CartType.TAKEAWAY
  return CartType.DELIVERY
}

function getTakeawayOwnerId(req: Request): string {
  const headerSessionId = req.headers['x-session-id'] as string | undefined
  const userId = req.decoded_authorization?.user_id
  return headerSessionId || userId || `guest_${req.ip || 'unknown'}`
}

function resolveSessionId(req: Request, type: OrderType, fallbackOwnerId: string): string {
  const tableSessionId = req.decoded_tokenTableSession?.sessionId
  const headerSessionId = req.headers['x-session-id'] as string | undefined
  const userId = req.decoded_authorization?.user_id

  if (type === OrderType.DINE_IN) return tableSessionId || crypto.randomUUID()
  if (type === OrderType.TAKEAWAY) return headerSessionId || userId || fallbackOwnerId
  return userId || crypto.randomUUID()
}

export const ordersController = {
  async newOrder(req: Request, res: Response) {
    const orderContext = req.order_context
    if (!orderContext) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Không có context đặt hàng'
      })
    }

    const body = (req.body ?? {}) as {
      note?: string
      deliveryInfo?: Record<string, unknown>
      paymentMethod?: string
    }

    const user = req.decoded_authorization

    let ownerId = ''
    let tableId: string | undefined

    if (orderContext.type === OrderType.DINE_IN) {
      tableId = orderContext.table?.tableId
      if (!tableId) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: 'Bạn chưa có bàn, vui lòng quét mã QR để tiếp tục'
        })
      }
      ownerId = tableId
    } else if (orderContext.type === OrderType.TAKEAWAY) {
      ownerId = getTakeawayOwnerId(req)
    } else {
      if (!user?.user_id) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: 'Phải đăng nhập để đặt giao hàng'
        })
      }
      ownerId = user.user_id
    }

    const cartType = mapOrderTypeToCartType(orderContext.type)

    const cart = await cartsServices.getCart(cartType, ownerId)
    if (!cart.items.length) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Giỏ hàng đang trống'
      })
    }

    if (tableId) {
      const existTable = await prisma.table.findUnique({
        where: { id: tableId },
        select: { id: true }
      })
      if (!existTable) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
          message: 'Bàn không tồn tại, vui lòng kiểm tra lại QR'
        })
      }

      const orderWaitingForConfirmation = await prisma.order.findFirst({
        where: {
          tableId,
          status: {
            in: [OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_CONFIRMATION]
          }
        },
        select: { id: true }
      })
      if (orderWaitingForConfirmation) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.CONFLICT,
          message: 'Bàn đang có đơn chờ xác nhận, vui lòng đợi quán xác nhận trước khi đặt thêm'
        })
      }
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: cart.items.map((i) => i.menuItemId) } },
      select: { id: true, name: true, basePrice: true, isAvailable: true }
    })
    const menuMap = new Map(menuItems.map((i) => [i.id, i]))

    const invalidItems = cart.items.filter((i) => !menuMap.has(i.menuItemId))
    if (invalidItems.length) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Một số món trong giỏ không còn tồn tại'
      })
    }

    const unavailableItems = cart.items.filter((i) => !menuMap.get(i.menuItemId)?.isAvailable)
    if (unavailableItems.length) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Một số món hiện không còn phục vụ'
      })
    }

    let subtotal = 0
    const orderItemsData = cart.items.map((item) => {
      const menuItem = menuMap.get(item.menuItemId)!
      const unitPrice = Number(menuItem.basePrice.toString())
      const subTotal = Number((unitPrice * item.quantity).toFixed(2))
      subtotal += subTotal

      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
        subTotal: new Prisma.Decimal(subTotal.toFixed(2)),
        snapshot: {
          menuItemId: item.menuItemId,
          name: menuItem.name,
          quantity: item.quantity,
          note: item.note || '',
          variantOptionIds: item.variantOptionIds || []
        },
        status: ItemStatus.WAITING,
        note: item.note || null
      }
    })

    const vatAmount = Number((subtotal * 0.1).toFixed(2))
    const totalAmount = Number((subtotal + vatAmount).toFixed(2))

    const paymentMethod =
      body.paymentMethod && Object.values(PaymentMethod).includes(body.paymentMethod as PaymentMethod)
        ? (body.paymentMethod as PaymentMethod)
        : PaymentMethod.CASH

    const isVnpay = paymentMethod === PaymentMethod.VNPAY // Thanh toan thẻ ví
    const orderStatus = isVnpay ? OrderStatus.PENDING_PAYMENT : OrderStatus.PENDING_CONFIRMATION
    const paymentStatus = isVnpay ? PaymentStatus.PENDING : PaymentStatus.UNPAID

    const orderCode = `FHUB_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const sessionId = resolveSessionId(req, orderContext.type, ownerId)

    const createdOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderCode, // dùng làm vnp_TxnRef
          type: orderContext.type,
          status: orderStatus,
          sessionId,
          note: body.note || null,
          tableId: tableId || undefined,
          customerId: orderContext.user?.user_id || undefined,
          confirmedById: orderContext.staffId || undefined,
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          vatAmount: new Prisma.Decimal(vatAmount.toFixed(2)),
          totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
          deliveryInfo: body.deliveryInfo ? (body.deliveryInfo as Prisma.InputJsonValue) : undefined,
          // Thêm expire cho VNPay
          ...(isVnpay ? { expireAt: new Date(Date.now() + 15 * 60 * 1000) } : {})
        }
      })

      await tx.orderItem.createMany({
        data: orderItemsData.map((it) => ({ ...it, orderId: order.id }))
      })

      await tx.payment.create({
        data: {
          orderId: order.id,
          method: paymentMethod,
          status: paymentStatus,
          amount: new Prisma.Decimal(totalAmount.toFixed(2)),
          gatewayData: {}
        }
      })

      return order
    })

    if (!isVnpay) {
      await cartsServices.clearCart(cartType, ownerId)
    } if (isVnpay) {
      const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || '127.0.0.1'
      const paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: totalAmount, // lib tự x100
        vnp_IpAddr: ip.replace(/^::ffff:/, ''),
        vnp_TxnRef: orderCode, // QUAN TRỌNG: dùng orderCode, không dùng order.id
        vnp_OrderInfo: `Thanh toan FoodHub ${orderCode}`,
        vnp_OrderType: ProductCode.Other,
        vnp_ReturnUrl: process.env.VNPAY_RETURN_URL!,
        vnp_Locale: VnpLocale.VN,
        vnp_CreateDate: dateFormat(new Date()),
        vnp_ExpireDate: dateFormat(new Date(Date.now() + 15 * 60 * 1000)),
      })

      return res.json(ApiResponse('Tạo đơn hàng VNPay, vui lòng thanh toán', {
        order: createdOrder,
        paymentUrl,
        orderCode
      }))
    }

    // CASH
    await cartsServices.clearCart(cartType, ownerId)
    await notificationsServices.createOrderCreated(createdOrder.id).catch((error) => {
      console.error('[Notification] Failed to create new order notification:', error)
    })
    // TODO: bắn socket cho quán: io.to(`restaurant`).emit('new-order', createdOrder)

    return res.json(ApiResponse('Tạo đơn hàng tiền mặt thành công', {
      order: createdOrder,
      items: orderItemsData
    }))
  },

  async history(req: Request, res: Response) {
    const user = req.decoded_authorization!
    const { query } = orderHistoryQuerySchema.parse({
      query: req.query
    })
    const result = await ordersServices.getHistory(user.user_id, user.role as Role, query)

    return res.json(ApiResponse('Lịch sử đơn hàng', result.orders, result.pagination))
  },

  async getKitchenOrders(req: Request, res: Response) {
    const { query } = kitchenOrdersQuerySchema.parse({
      query: req.query
    })

    const result = await ordersServices.getKitchenOrders(query)

    return res.json(ApiResponse('Danh sách món bếp', result.items, result.pagination))
  },
  async confirm(req: Request, res: Response) {
    const user = req.decoded_authorization!
    const { params } = confirmOrderSchema.parse({
      params: req.params,
      body: req.body
    })

    const order = await ordersServices.confirmOrder(params.id, user.user_id)

    return res.json(ApiResponse('Xác nhận đơn hàng thành công', order))
  },

  async reject(req: Request, res: Response) {
    const user = req.decoded_authorization!
    const { params, body } = rejectOrderSchema.parse({
      params: req.params,
      body: req.body
    })

    const order = await ordersServices.rejectOrder(
      params.id,
      body.reason,
      user.user_id,
      user.role as 'STAFF' | 'ADMIN'
    )

    return res.json(ApiResponse('Đã từ chối đơn hàng', order))
  },

  async updateKitchenStatus(req: Request, res: Response) {
    const { user_id, role } = req.decoded_authorization as TokenPayload
    const { params, body } = updateKitchenItemStatusSchema.parse({
      params: req.params,
      body: req.body
    })

    const { updatedItem, previousItemStatus, orderStatusChanged, previousOrderStatus, order } = await ordersServices.updateKitchenItemStatus(params.itemId, body.status)

    emitOrderItemStatusUpdate({
      orderId: updatedItem.orderId,
      itemId: updatedItem.id,
      previousStatus: previousItemStatus,
      status: updatedItem.status,
      updatedAt: new Date().toISOString(),
      updatedBy: {
        userId: user_id,
        role: role,
      }
    })

    if (orderStatusChanged && order) {
      emitOrderStatusUpdate({
        orderId: order.id,
        orderType: order.type,
        previousStatus: previousOrderStatus,
        status: order.status,
        updatedAt: new Date().toISOString(),
        updatedBy: {
          userId: user_id,
          role: role,
        }
      })

      await notificationsServices.createOrderStatusNotification({
        orderId: order.id,
        previousStatus: previousOrderStatus,
        status: order.status,
        actorRole: role as Role
      }).catch((error) => {
        console.error('[Notification] Failed to create kitchen status notification:', error)
      })
    }

    return res.json(ApiResponse('Cập nhật trạng thái món thành công', updatedItem))
  },

  async serve(req: Request, res: Response) {
    const { params } = serveOrderSchema.parse({
      params: req.params,
      body: req.body
    })

    const order = await ordersServices.serveOrder(params.id)

    return res.json(ApiResponse('Đã phục vụ đơn hàng', order))
  },

  async cancel(req: Request, res: Response) {
    const user = req.decoded_authorization!
    const { params, body } = cancelOrderSchema.parse({
      params: req.params,
      body: req.body
    })

    const order = await ordersServices.cancelOrder(
      params.id,
      user.user_id,
      user.role as Role,
      body.reason
    )

    return res.json(ApiResponse('Hủy đơn hàng thành công', order))
  }
}
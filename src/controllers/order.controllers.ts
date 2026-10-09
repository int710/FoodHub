import { Request, Response } from 'express'
import { prisma } from '~/config/prisma'
import HTTP_STATUS from '~/constants/httpStatus'
import { Prisma } from '~/generated/prisma/client'
import { ItemStatus, OrderStatus, OrderType, PaymentMethod, PaymentStatus, Role } from '~/generated/prisma/enums'
import { ApiResponse } from '~/models/ApiResponse'
import { ErrorWithStatus } from '~/models/Errors'
import { HistoryQuery, kitchenOrdersQuerySchema, KitchenQuery } from '~/models/schemas/order.schema'
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
import { emitOrderItemStatusUpdate, emitOrderStatusUpdate } from '~/socket/orders/order.emitter'
import { TokenPayload } from '~/models/schemas/token.schema'
import notificationsServices from '~/services/notifications.services'
import { buildVnpayPaymentUrl, getClientIp, VNPAY_PAYMENT_TIMEOUT_MS } from '~/utils/vnpay-payment'
import { expireStalePaymentOrders } from '~/services/order-expiration.services'
import {
  createZaloPayOrder,
  createZaloPayTransactionId,
  ZALOPAY_PAYMENT_TIMEOUT_MS
} from '~/services/zalopay.services'

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
    const paymentMethod =
      body.paymentMethod && Object.values(PaymentMethod).includes(body.paymentMethod as PaymentMethod)
        ? (body.paymentMethod as PaymentMethod)
        : PaymentMethod.CASH
    const isVnpay = paymentMethod === PaymentMethod.VNPAY
    const isZalopay = paymentMethod === PaymentMethod.ZALOPAY
    const isOnlinePayment = isVnpay || isZalopay

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
    }

    // Render có thể sleep nên không dựa vào cron: dọn giao dịch hết hạn ngay
    // trước checkout, sau đó mới quyết định tiếp tục hay tạo đơn mới.
    await expireStalePaymentOrders()
    const ownerWhere: Prisma.OrderWhereInput = tableId
      ? { tableId }
      : orderContext.type === OrderType.TAKEAWAY
        ? { type: OrderType.TAKEAWAY, sessionId: ownerId }
        : { type: OrderType.DELIVERY, customerId: ownerId }
    const existingOrder = await prisma.order.findFirst({
      where: {
        ...ownerWhere,
        status: { in: [OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_CONFIRMATION] }
      },
      include: { payments: true },
      orderBy: { createdAt: 'desc' }
    })

    if (existingOrder?.status === OrderStatus.PENDING_CONFIRMATION) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.CONFLICT,
        message: 'Đơn trước đang chờ quán xác nhận. Bạn có thể gọi thêm món sau khi quán xác nhận.'
      })
    }

    if (existingOrder?.status === OrderStatus.PENDING_PAYMENT) {
      const pendingVnpay = existingOrder.payments.find(
        (payment) => payment.method === PaymentMethod.VNPAY && payment.status === PaymentStatus.PENDING
      )
      const pendingZalopay = existingOrder.payments.find(
        (payment) => payment.method === PaymentMethod.ZALOPAY && payment.status === PaymentStatus.PENDING
      )

      if (isVnpay && pendingVnpay) {
        const expireAt = new Date(Date.now() + VNPAY_PAYMENT_TIMEOUT_MS)
        await prisma.order.update({
          where: { id: existingOrder.id },
          data: { expireAt }
        })
        const paymentUrl = buildVnpayPaymentUrl({
          amount: Number(existingOrder.totalAmount.toString()),
          orderCode: existingOrder.orderCode,
          clientIp: getClientIp(req)
        })
        return res.json(ApiResponse('Tiếp tục thanh toán đơn VNPay đang chờ', {
          order: { ...existingOrder, expireAt },
          paymentUrl,
          orderCode: existingOrder.orderCode,
          resumed: true
        }))
      }

      if (isZalopay && pendingZalopay) {
        const storedGateway = pendingZalopay.gatewayData as Record<string, unknown>
        let paymentUrl = typeof storedGateway.orderUrl === 'string' ? storedGateway.orderUrl : ''
        let qrCode = typeof storedGateway.qrCode === 'string' ? storedGateway.qrCode : null
        let gatewayData = storedGateway
        let createdGatewayOrder = false
        let expireAt = existingOrder.expireAt || new Date(Date.now() + ZALOPAY_PAYMENT_TIMEOUT_MS)

        if (!paymentUrl) {
          const zaloOrder = await createZaloPayOrder({
            orderCode: existingOrder.orderCode,
            amount: Number(existingOrder.totalAmount.toString()),
            appUser: existingOrder.customerId || existingOrder.sessionId,
            appTransId: pendingZalopay.txnRef || createZaloPayTransactionId(existingOrder.orderCode)
          })
          paymentUrl = zaloOrder.orderUrl
          createdGatewayOrder = true
          qrCode = zaloOrder.qrCode
          gatewayData = {
            provider: 'ZALOPAY',
            orderUrl: zaloOrder.orderUrl,
            qrCode: zaloOrder.qrCode,
            zpTransToken: zaloOrder.zpTransToken,
            orderToken: zaloOrder.orderToken,
            createResponse: zaloOrder.raw
          }
          expireAt = new Date(Date.now() + ZALOPAY_PAYMENT_TIMEOUT_MS)
          await prisma.payment.update({
            where: { id: pendingZalopay.id },
            data: { txnRef: zaloOrder.appTransId, gatewayData: gatewayData as Prisma.InputJsonValue }
          })
        }

        if (!existingOrder.expireAt || createdGatewayOrder) {
          await prisma.order.update({ where: { id: existingOrder.id }, data: { expireAt } })
        }
        return res.json(ApiResponse('Tiếp tục thanh toán đơn ZaloPay đang chờ', {
          order: { ...existingOrder, expireAt },
          paymentUrl,
          orderUrl: paymentUrl,
          qrCode,
          orderCode: existingOrder.orderCode,
          provider: PaymentMethod.ZALOPAY,
          resumed: true
        }))
      }

      // Người dùng đổi phương thức: kết thúc giao dịch online cũ rồi tạo đơn mới
      // từ giỏ hiện tại, không để một bàn có hai giao dịch chờ song song.
      await prisma.$transaction([
        prisma.order.update({
          where: { id: existingOrder.id },
          data: { status: OrderStatus.PAYMENT_FAILED }
        }),
        prisma.payment.updateMany({
          where: { orderId: existingOrder.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED }
        })
      ])
    }

    const cart = await cartsServices.getCart(cartType, ownerId)
    if (!cart.items.length) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Giỏ hàng đang trống'
      })
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: cart.items.map((i) => i.menuItemId) } },
      select: { id: true, name: true, image: true, basePrice: true, isAvailable: true }
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

    const selectedOptionIds = [...new Set(cart.items.flatMap((item) => item.variantOptionIds || []))]
    const selectedOptions = selectedOptionIds.length
      ? await prisma.variantOption.findMany({
          where: { id: { in: selectedOptionIds }, isActive: true },
          select: { id: true, name: true, priceAdd: true, group: { select: { itemId: true } } }
        })
      : []
    const optionMap = new Map(selectedOptions.map((option) => [option.id, option]))
    const hasInvalidOption = cart.items.some((item) =>
      (item.variantOptionIds || []).some((id) => {
        const option = optionMap.get(id)
        return !option || option.group.itemId !== item.menuItemId
      })
    )
    if (hasInvalidOption) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Một số tùy chọn món không còn hợp lệ, vui lòng chọn lại'
      })
    }

    let subtotal = 0
    const orderItemsData = cart.items.map((item) => {
      const menuItem = menuMap.get(item.menuItemId)!
      const itemOptions = (item.variantOptionIds || []).map((id) => optionMap.get(id)!)
      const unitPrice = Number(menuItem.basePrice.toString()) +
        itemOptions.reduce((sum, option) => sum + Number(option.priceAdd.toString()), 0)
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
          image: menuItem.image,
          quantity: item.quantity,
          note: item.note || '',
          variantOptionIds: item.variantOptionIds || [],
          variantOptions: itemOptions.map((option) => ({
            id: option.id,
            name: option.name,
            priceAdd: Number(option.priceAdd.toString())
          }))
        },
        status: ItemStatus.WAITING,
        note: item.note || null
      }
    })

    const vatAmount = Number((subtotal * 0.1).toFixed(2))
    const totalAmount = Number((subtotal + vatAmount).toFixed(2))

    const orderStatus = isOnlinePayment ? OrderStatus.PENDING_PAYMENT : OrderStatus.PENDING_CONFIRMATION
    const paymentStatus = isOnlinePayment ? PaymentStatus.PENDING : PaymentStatus.UNPAID

    const orderCode = `FHUB_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const sessionId = resolveSessionId(req, orderContext.type, ownerId)
    const zaloAppTransId = isZalopay ? createZaloPayTransactionId(orderCode) : undefined

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
          ...(isOnlinePayment
            ? { expireAt: new Date(Date.now() + (isZalopay ? ZALOPAY_PAYMENT_TIMEOUT_MS : VNPAY_PAYMENT_TIMEOUT_MS)) }
            : {})
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
          txnRef: zaloAppTransId,
          gatewayData: {}
        }
      })

      return order
    })

    if (isVnpay) {
      const paymentUrl = buildVnpayPaymentUrl({
        amount: totalAmount,
        orderCode,
        clientIp: getClientIp(req)
      })

      return res.json(ApiResponse('Tạo đơn hàng VNPay, vui lòng thanh toán', {
        order: createdOrder,
        paymentUrl,
        orderCode
      }))
    }


    if (isZalopay) {
      try {
        const zaloOrder = await createZaloPayOrder({
          orderCode,
          amount: totalAmount,
          appUser: orderContext.user?.user_id || sessionId,
          appTransId: zaloAppTransId,
          items: orderItemsData.map((item) => ({
            itemid: item.menuItemId,
            itemname: (item.snapshot as { name: string }).name,
            itemprice: Number(item.unitPrice.toString()),
            itemquantity: item.quantity
          }))
        })
        await prisma.payment.updateMany({
          where: { orderId: createdOrder.id, method: PaymentMethod.ZALOPAY },
          data: {
            txnRef: zaloOrder.appTransId,
            gatewayData: {
              provider: 'ZALOPAY',
              orderUrl: zaloOrder.orderUrl,
              qrCode: zaloOrder.qrCode,
              zpTransToken: zaloOrder.zpTransToken,
              orderToken: zaloOrder.orderToken,
              createResponse: zaloOrder.raw
            } as Prisma.InputJsonValue
          }
        })

        return res.json(ApiResponse('Tạo đơn hàng ZaloPay, vui lòng thanh toán', {
          order: createdOrder,
          paymentUrl: zaloOrder.orderUrl,
          orderUrl: zaloOrder.orderUrl,
          qrCode: zaloOrder.qrCode,
          orderCode,
          provider: PaymentMethod.ZALOPAY
        }))
      } catch (error) {
        await prisma.$transaction([
          prisma.order.update({ where: { id: createdOrder.id }, data: { status: OrderStatus.PAYMENT_FAILED } }),
          prisma.payment.updateMany({
            where: { orderId: createdOrder.id, method: PaymentMethod.ZALOPAY },
            data: {
              status: PaymentStatus.FAILED,
              gatewayData: { createError: error instanceof Error ? error.message : 'Unknown error' }
            }
          })
        ])
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.BAD_GATEWAY,
          message: error instanceof Error ? error.message : 'Không thể kết nối ZaloPay'
        })
      }
    }

    // CASH: đơn đã được gửi quán nên giỏ mới được xóa.
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

import { prisma } from '~/config/prisma'
import { Prisma } from '~/generated/prisma/client'
import { OrderStatus, OrderType, PaymentMethod, PaymentStatus } from '~/generated/prisma/enums'
import cartsServices, { CartType } from '~/services/carts.services'
import notificationsServices from '~/services/notifications.services'
import { queryZaloPayOrder } from '~/services/zalopay.services'
import { emitOrderStatusUpdate } from '~/socket/orders/order.emitter'

export type ZaloPaymentRef = {
  id: string
  amount: Prisma.Decimal
  status: PaymentStatus
  gatewayData: Prisma.JsonValue
  txnRef: string | null
}

export type ZaloOrderRef = {
  id: string
  orderCode: string
  type: OrderType
  status: OrderStatus
  totalAmount: Prisma.Decimal
  tableId: string | null
  customerId: string | null
  sessionId: string
  expireAt: Date | null
}

export const asGatewayObject = (value: Prisma.JsonValue): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const cartType = (type: OrderType) => {
  if (type === OrderType.DINE_IN) return CartType.DINE_IN
  if (type === OrderType.TAKEAWAY) return CartType.TAKEAWAY
  return CartType.DELIVERY
}

export async function settleZaloPaymentSuccess(
  payment: ZaloPaymentRef,
  order: ZaloOrderRef,
  amount: number,
  gatewayData: Record<string, unknown>
) {
  if (Number(payment.amount.toString()) !== Number(amount)) {
    throw new Error('Số tiền ZaloPay không khớp với đơn hàng')
  }

  const paidAt = new Date()
  const nextOrderStatus =
    order.status === OrderStatus.PENDING_PAYMENT || order.status === OrderStatus.PAYMENT_FAILED
      ? OrderStatus.PENDING_CONFIRMATION
      : order.status

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: nextOrderStatus, paidAt, expireAt: null }
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        method: PaymentMethod.ZALOPAY,
        status: PaymentStatus.PAID,
        paidAt,
        gatewayData: {
          ...asGatewayObject(payment.gatewayData),
          paymentResult: gatewayData
        } as Prisma.InputJsonValue
      }
    })
  ])

  if (nextOrderStatus !== order.status) {
    emitOrderStatusUpdate({
      orderId: order.id,
      orderType: order.type,
      previousStatus: order.status,
      status: nextOrderStatus,
      updatedAt: paidAt.toISOString()
    })
    await notificationsServices.createOrderStatusNotification({
      orderId: order.id,
      previousStatus: order.status,
      status: nextOrderStatus
    }).catch((error) => console.error('[ZaloPay] notification failed:', error))
    await notificationsServices.createOrderCreated(order.id)
      .catch((error) => console.error('[ZaloPay] order notification failed:', error))
  }

  const ownerId = order.type === OrderType.DINE_IN ? order.tableId : order.customerId || order.sessionId
  if (ownerId) {
    await cartsServices.clearCart(cartType(order.type), ownerId)
      .catch((error) => console.error('[ZaloPay] clear cart failed:', error))
  }
  return { paidAt, orderStatus: nextOrderStatus, paymentStatus: PaymentStatus.PAID, restoredCash: false }
}

export async function settleZaloPaymentFailure(
  payment: Pick<ZaloPaymentRef, 'id' | 'gatewayData'>,
  order: Pick<ZaloOrderRef, 'id' | 'status'>,
  reason: string,
  raw: Record<string, unknown> = {}
) {
  const gateway = asGatewayObject(payment.gatewayData)
  if (gateway.convertedFromCash === true) {
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { expireAt: null } }),
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          method: PaymentMethod.CASH,
          status: PaymentStatus.UNPAID,
          txnRef: null,
          gatewayData: {
            ...gateway,
            revertedReason: reason,
            paymentResult: raw
          } as Prisma.InputJsonValue
        }
      })
    ])
    return { restoredCash: true, orderStatus: order.status, paymentStatus: PaymentStatus.UNPAID }
  }

  const nextOrderStatus = order.status === OrderStatus.PENDING_PAYMENT
    ? OrderStatus.PAYMENT_FAILED
    : order.status
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: nextOrderStatus, expireAt: null }
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        gatewayData: { ...gateway, failureReason: reason, paymentResult: raw } as Prisma.InputJsonValue
      }
    })
  ])
  return { restoredCash: false, orderStatus: nextOrderStatus, paymentStatus: PaymentStatus.FAILED }
}

export async function reconcileZaloPayment(payment: ZaloPaymentRef, order: ZaloOrderRef) {
  if (payment.status !== PaymentStatus.PENDING || !payment.txnRef) {
    return {
      restoredCash: false,
      orderStatus: order.status,
      paymentStatus: payment.status,
      raw: {} as Record<string, unknown>
    }
  }

  const result = await queryZaloPayOrder(payment.txnRef)
  if (result.isPaid) {
    return {
      ...(await settleZaloPaymentSuccess(
        payment,
        order,
        Number(result.raw.amount ?? order.totalAmount.toString()),
        result.raw
      )),
      raw: result.raw
    }
  }
  if (!result.isProcessing || (order.expireAt !== null && order.expireAt <= new Date())) {
    return {
      ...(await settleZaloPaymentFailure(payment, order, 'ZALOPAY_NOT_PAID', result.raw)),
      raw: result.raw
    }
  }
  return {
    restoredCash: false,
    orderStatus: order.status,
    paymentStatus: payment.status,
    raw: result.raw
  }
}

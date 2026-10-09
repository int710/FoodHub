import { prisma } from '~/config/prisma'
import { OrderStatus, PaymentMethod, PaymentStatus } from '~/generated/prisma/enums'
import { reconcileZaloPayment } from '~/services/zalopay-payment-state.services'
import {
  clearTableRuntimeDataIfAvailable,
  occupyingOrderWhere,
  ONLINE_PAYMENT_TIMEOUT_MS
} from '~/services/table-runtime.services'

/**
 * Chuyển các giao dịch online quá hạn sang trạng thái kết thúc. Một job nền sẽ
 * tối ưu hơn khi lưu lượng lớn; việc gọi trước các truy vấn bàn/checkout bảo đảm
 * dữ liệu vẫn đúng cả trên Render free tier (process có thể sleep).
 */
export async function expireStalePaymentOrders(orderId?: string) {
  const now = new Date()
  const legacyCutoff = new Date(now.getTime() - ONLINE_PAYMENT_TIMEOUT_MS)

  // ZaloPay yêu cầu chủ động query khi callback bị lỡ. Không được đánh dấu fail
  // chỉ dựa vào đồng hồ vì giao dịch có thể đã thu tiền nhưng callback đến chậm.
  const staleZaloPayments = await prisma.payment.findMany({
    where: {
      ...(orderId ? { orderId } : {}),
      method: PaymentMethod.ZALOPAY,
      status: PaymentStatus.PENDING,
      order: { expireAt: { lte: now } }
    },
    include: { order: true }
  })
  for (const payment of staleZaloPayments) {
    await reconcileZaloPayment(payment, payment.order).catch((error) => {
      // Giữ PENDING khi ZaloPay tạm thời không truy cập được; lần request sau
      // sẽ query lại, tránh biến một giao dịch đã thu tiền thành thất bại.
      console.error('[ZaloPay] reconcile expired payment failed:', error)
      return prisma.order.update({
        where: { id: payment.orderId },
        data: { expireAt: new Date(Date.now() + 60_000) }
      }).catch((updateError) => console.error('[ZaloPay] defer reconcile failed:', updateError))
    })
  }

  const result = await prisma.$transaction(async (tx) => {
    const expired = await tx.order.findMany({
      where: {
        ...(orderId ? { id: orderId } : {}),
        status: OrderStatus.PENDING_PAYMENT,
        payments: {
          none: { method: PaymentMethod.ZALOPAY, status: PaymentStatus.PENDING }
        },
        OR: [
          { expireAt: { lte: now } },
          { expireAt: null, createdAt: { lte: legacyCutoff } }
        ]
      },
      select: { id: true, tableId: true }
    })

    const ids = expired.map((order) => order.id)
    if (ids.length) {
      await tx.order.updateMany({
        where: { id: { in: ids }, status: OrderStatus.PENDING_PAYMENT },
        data: { status: OrderStatus.PAYMENT_FAILED }
      })
      await tx.payment.updateMany({
        where: { orderId: { in: ids }, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED }
      })
    }

    return {
      count: ids.length,
      tableIds: [...new Set(expired.map((order) => order.tableId).filter((tableId): tableId is string => Boolean(tableId)))]
    }
  })

  for (const tableId of result.tableIds) {
    await clearTableRuntimeDataIfAvailable(tableId, now)
  }

  return result.count
}

import { prisma } from '~/config/prisma'
import { OrderStatus, PaymentStatus } from '~/generated/prisma/enums'

const VNPAY_TIMEOUT_MS = 15 * 60 * 1000

/**
 * Chuyển các giao dịch VNPay quá hạn sang trạng thái kết thúc. Một job nền sẽ
 * tối ưu hơn khi lưu lượng lớn; việc gọi trước các truy vấn bàn/checkout bảo đảm
 * dữ liệu vẫn đúng cả trên Render free tier (process có thể sleep).
 */
export async function expireStaleVnpayOrders(orderId?: string) {
  const now = new Date()
  const legacyCutoff = new Date(now.getTime() - VNPAY_TIMEOUT_MS)

  return prisma.$transaction(async (tx) => {
    const expired = await tx.order.findMany({
      where: {
        ...(orderId ? { id: orderId } : {}),
        status: OrderStatus.PENDING_PAYMENT,
        OR: [
          { expireAt: { lte: now } },
          { expireAt: null, createdAt: { lte: legacyCutoff } }
        ]
      },
      select: { id: true }
    })

    const ids = expired.map((order) => order.id)
    if (!ids.length) return 0

    await tx.order.updateMany({
      where: { id: { in: ids }, status: OrderStatus.PENDING_PAYMENT },
      data: { status: OrderStatus.PAYMENT_FAILED }
    })
    await tx.payment.updateMany({
      where: { orderId: { in: ids }, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED }
    })

    return ids.length
  })
}

export function occupyingOrderWhere(now = new Date()) {
  const legacyCutoff = new Date(now.getTime() - VNPAY_TIMEOUT_MS)
  return {
    OR: [
      {
        status: {
          in: [
            OrderStatus.PENDING_CONFIRMATION,
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.SERVED
          ]
        }
      },
      {
        status: OrderStatus.PENDING_PAYMENT,
        OR: [
          { expireAt: { gt: now } },
          { expireAt: null, createdAt: { gt: legacyCutoff } }
        ]
      }
    ]
  }
}

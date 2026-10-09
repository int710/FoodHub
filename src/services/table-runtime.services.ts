import { redis } from '~/config/redis'
import { RedisKey } from '~/constants/redis'
import { prisma } from '~/config/prisma'
import { OrderStatus } from '~/generated/prisma/enums'

export const ONLINE_PAYMENT_TIMEOUT_MS = 15 * 60 * 1000

export function occupyingOrderWhere(now = new Date()) {
  const legacyCutoff = new Date(now.getTime() - ONLINE_PAYMENT_TIMEOUT_MS)
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

/**
 * Xóa dữ liệu tạm của một lượt sử dụng bàn. Order/payment vẫn được giữ trong
 * PostgreSQL để phục vụ lịch sử và báo cáo.
 */
export async function clearTableRuntimeData(tableId: string) {
  const sessionsKey = RedisKey.tableSessions(tableId)
  const sessionIds = await redis.smembers(sessionsKey)
  const keys = [
    ...sessionIds.map(RedisKey.tableSession),
    sessionsKey,
    RedisKey.tableHost(tableId),
    RedisKey.cart('DINE_IN', tableId),
    // Key cũ được giữ trong cleanup để không sót dữ liệu từ phiên bản trước.
    RedisKey.cartTable(tableId)
  ]

  await redis.del(...keys)
}

export async function clearTableRuntimeDataIfAvailable(tableId: string, now = new Date()) {
  const activeOrderCount = await prisma.order.count({
    where: { tableId, ...occupyingOrderWhere(now) }
  })
  if (activeOrderCount > 0) return false

  await clearTableRuntimeData(tableId)
  return true
}

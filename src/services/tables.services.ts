import { randomUUID } from 'crypto'
import { prisma } from '~/config/prisma'
import { redis } from '~/config/redis'
import { TABLE_SESSION_TTL } from '~/constants/const'
import HTTP_STATUS from '~/constants/httpStatus'
import { TABLE_MESSAGE } from '~/constants/message'
import { RedisKey, TTL_8H } from '~/constants/redis'
import { ErrorWithStatus } from '~/models/Errors'
import { TableReqBody } from '~/models/schemas/table.schema'
import { signToken } from '~/utils/jwt'
import { generateQR } from '~/utils/QRCode'

class TableServices {
  async createNewTable(body: TableReqBody) {
    const { name, capacity, floor, note } = body
    const tableExists = await prisma.table.findUnique({ where: { name } })
    if (tableExists) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.CONFLICT,
        message: TABLE_MESSAGE.TABLE_NAME_ALREADY_EXISTS
      })
    }
    const newTable = await prisma.table.create({
      data: { name, capacity, floor, note },
      select: {
        id: true,
        name: true,
        capacity: true,
        floor: true,
        note: true,
        qrToken: true,
        isActive: true,
        createdAt: true
      }
    })
    return newTable
  }

  async getTableById(id: string) {
    const table = await prisma.table.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        capacity: true,
        floor: true,
        note: true,
        qrToken: true,
        isActive: true,
        createdAt: true
      }
    })
    if (!table) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: TABLE_MESSAGE.TABLE_NOT_FOUND })
    }
    return table
  }

  async getQR(id: string) {
    const table = await prisma.table.findUnique({ where: { id }, select: { name: true, qrToken: true } })
    if (!table) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: TABLE_MESSAGE.TABLE_NOT_FOUND })
    }
    const qrContent = `${process.env.CLIENT_URL}/scan?token=${table.qrToken}`
    const qrImageUrl = await generateQR(qrContent)
    return { name: table.name, qrToken: table.qrToken, qrContent, qrImageUrl }
  }

  async regenerateQR(id: string) {
    await prisma.table.findUniqueOrThrow({ where: { id } })
    const qrUpdate = await prisma.table.update({
      where: { id },
      data: {
        qrToken: randomUUID()
      },
      select: { id: true, name: true, qrToken: true }
    })
    const qrContent = `${process.env.CLIENT_URL}/scan?token=${qrUpdate.qrToken}`
    const qrImageUrl = await generateQR(qrContent)
    return { ...qrUpdate, qrContent, qrImageUrl }
  }

  async toggleTable(id: string) {
    const table = await prisma.table.findUniqueOrThrow({ where: { id }, select: { isActive: true } })
    return prisma.table.update({
      where: { id },
      data: { isActive: !table.isActive },
      select: { id: true, name: true, isActive: true }
    })
  }

  async scanQR(qrToken: string) {
    const table = await prisma.table.findUnique({
      where: { qrToken },
      include: {
        orders: {
          where: { status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] } },
          select: { id: true, status: true },
          take: 1
        }
      }
    })

    if (!table) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: TABLE_MESSAGE.QR_CODE_INVALID })
    }
    if (!table.isActive) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Bàn đang tạm ngưng hoạt động, vui lòng liên hệ nhân viên !'
      })
    }

    // Check xem bàn đã có người ngồi chưa
    const isOccupied = table.orders.length > 0
    const activeOrder = table.orders[0]
    if (isOccupied) {
      const availableTables = await prisma.table.findMany({
        where: {
          isActive: true,
          id: { not: table.id },
          orders: { none: { status: { in: ['PENDING_PAYMENT', 'PREPARING', 'CONFIRMED', 'SERVED', 'READY'] } } }
        },
        select: { id: true, name: true, capacity: true, floor: true },
        orderBy: { name: 'asc' }
      })

      return {
        occupied: true,
        table: { id: table.id, name: table.name, capacity: table.capacity },
        tableToken: null,
        message: `Bàn ${table.name} đang có khách rồi, bạn vui lòng chọn bàn khác !`,
        availableTables
      }
    }

    const sessionId = randomUUID()

    // Tìm kiếm xem bàn này đã có chủ hay chưa
    const currentHost = await redis.get(RedisKey.tableHost(table.id))
    const needNewHost = !currentHost || !(await redis.exists(RedisKey.tableSession(currentHost)))
    if (needNewHost) await redis.set(RedisKey.tableHost(table.id), sessionId, TTL_8H)

    const [tableToken] = await Promise.all([
      signToken({
        payload: { tableId: table.id, name: table.name, sessionId, isHost: needNewHost },
        secretOrPrivateKey: process.env.SECRET_TABLE_TOKEN as string,
        options: { expiresIn: '8h' }
      }),
      redis.set(RedisKey.tableSession(sessionId), table.id, TABLE_SESSION_TTL),
      redis.sadd(RedisKey.tableSessions(table.id), sessionId)
    ])

    if (!activeOrder && needNewHost) {
      await redis.del(RedisKey.cartTable(table.id))
    }

    return {
      occupied: false,
      table: {
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        floor: table.floor
      },
      tableToken,
      sessionId,
      expiresIn: TABLE_SESSION_TTL,
      activeOrderId: table.orders[0]?.id || null,
      message: `Chào mừng bạn đến ${table.name}`
    }
  }

  async transferHost(tableId: string, newSessionId: string) {
    await redis.set(RedisKey.tableHost(tableId), newSessionId, TTL_8H)
    return { ok: true }
  }
}

const tableServices = new TableServices()
export default tableServices

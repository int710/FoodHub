import { randomUUID } from 'crypto'
import { prisma } from '~/config/prisma'
import HTTP_STATUS from '~/constants/httpStatus'
import { TABLE_MESSAGE } from '~/constants/message'
import { ErrorWithStatus } from '~/models/Errors'
import { TableReqBody } from '~/models/schemas/table.schema'
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
}

const tableServices = new TableServices()
export default tableServices

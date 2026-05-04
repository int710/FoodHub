import { prisma } from '~/config/prisma'
import HTTP_STATUS from '~/constants/httpStatus'
import { TABLE_MESSAGE } from '~/constants/message'
import { ErrorWithStatus } from '~/models/Errors'
import { TableReqBody } from '~/models/schemas/table.schema'

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
}

const tableServices = new TableServices()
export default tableServices

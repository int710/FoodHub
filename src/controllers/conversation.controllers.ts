import { Request, Response } from 'express'
import mongoose from 'mongoose'
import HTTP_STATUS from '~/constants/httpStatus'
import { prisma } from '~/config/prisma'
import { ApiResponse } from '~/models/ApiResponse'
import { ErrorWithStatus } from '~/models/Errors'
import { ConversationModel, ConversationStatus } from '~/models/mongodb/conversation.model'
import { getSocketIO } from '~/socket/socket.instance'
import { getConversationRoom, HOST_ROOM } from '~/socket/socket.room'

export const conversationController = {
  async list(_req: Request, res: Response) {
    const conversations = await ConversationModel.find({ status: ConversationStatus.OPEN })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean()
    const ownerIds = conversations.map((conversation) => String(conversation.customerId))
    const [users, tables, orders] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } }),
      prisma.table.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true, floor: true } }),
      prisma.order.findMany({
        where: { OR: [{ customerId: { in: ownerIds } }, { tableId: { in: ownerIds } }] },
        select: { orderCode: true, customerId: true, tableId: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      })
    ])
    const userNames = new Map(users.map((user) => [user.id, user.name]))
    const tableNames = new Map(tables.map((table) => [table.id, `${table.name}${table.floor ? ` · ${table.floor}` : ''}`]))
    const latestOrderByOwner = new Map<string, string>()
    orders.forEach((order) => {
      const ownerId = order.customerId || order.tableId
      if (ownerId && !latestOrderByOwner.has(ownerId)) latestOrderByOwner.set(ownerId, order.orderCode)
    })
    const data = conversations.map((conversation) => {
      const ownerId = String(conversation.customerId)
      return {
        ...conversation,
        customerName: userNames.get(ownerId) || tableNames.get(ownerId) || 'Khách tại bàn',
        orderCode: latestOrderByOwner.get(ownerId) || null
      }
    })
    return res.json(ApiResponse('Danh sách hội thoại', data))
  },

  async close(req: Request<{ id: string }>, res: Response) {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.BAD_REQUEST, message: 'Mã hội thoại không hợp lệ' })
    }
    const conversation = await ConversationModel.findByIdAndUpdate(
      id,
      { status: ConversationStatus.CLOSED },
      { new: true }
    ).lean()
    if (!conversation) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy hội thoại' })
    }
    const io = getSocketIO()
    const payload = { conversationId: id, status: ConversationStatus.CLOSED }
    io.to(getConversationRoom(id)).emit('conversation:closed', payload)
    io.to(HOST_ROOM).emit('conversation:updated', { ...conversation, ...payload })
    return res.json(ApiResponse('Đã đóng hội thoại', conversation))
  }
}

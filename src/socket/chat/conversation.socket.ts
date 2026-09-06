import { Server, Socket } from 'socket.io'

import { getConversationRoom, HOST_ROOM } from '../socket.room'
import { ConversationModel } from '~/models/mongodb/conversation.model'
import { SenderRole } from '~/models/mongodb/message.model'
import { ConversationServices } from '~/services/conversation.services'

interface JoinConversationPayload {
  conversationId: string
  page?: number
  limit?: number
  beforeMessageId?: string
}

export const registerConversationSocket = (io: Server, socket: Socket): void => {
  socket.on(
    'conversation:join',
    async (
      payload: JoinConversationPayload,
      callback?: (response: { success: boolean; message?: string; data?: any }) => void
    ) => {
      try {
        const user = socket.data.user
        if (!user) {
          return callback?.({ success: false, message: 'Unauthenticated' })
        }

        const { conversationId, page = 1, limit = 20 } = payload || {}
        if (!conversationId) {
          return callback?.({ success: false, message: 'conversationId is required' })
        }

        const conversation = await ConversationModel.findById(conversationId)
        if (!conversation) {
          return callback?.({ success: false, message: 'Conversation not found' })
        }

        const userRoleLower = user.role?.toLowerCase()
        const isCustomer = userRoleLower === SenderRole.CUSTOMER
        const isHost = userRoleLower === SenderRole.STAFF || userRoleLower === SenderRole.ADMIN
        const customerOwnerId = user.authType === 'TABLE_GUEST'
          ? user.tableId
          : String(user.user_id)

        // Validate quyền truy cập của Customer
        if (isCustomer && conversation.customerId !== customerOwnerId) {
          return callback?.({ success: false, message: 'Forbidden: Access denied' })
        }

        const room = getConversationRoom(conversationId)
        socket.join(room)

        if (isHost) {
          const { conversation: updatedConv, isAssigned } = await ConversationServices.assignedHostIfUnassigned(conversationId, String(user.user_id))

          if (isAssigned && updatedConv) {
            io.to(HOST_ROOM).emit('conversation:updated', updatedConv)
          }
        }

        const historyData = await ConversationServices.getMessageHistory({
          conversationId,
          page: Number(page),
          limit: Number(limit)
        })
        socket.emit('message:history', historyData)

        callback?.({
          success: true,
          data: { ...historyData }
        })

        console.log(`[Socket] User ${user.user_id} (${userRoleLower}) joined room: ${room}`)
      } catch (error) {
        console.error('[Socket Error] conversation:join:', error)
        callback?.({
          success: false,
          message: 'Internal server error while joining conversation'
        })
      }
    }
  )
}
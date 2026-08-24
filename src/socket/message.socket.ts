import { Server, Socket } from "socket.io";
import { ConversationModel, ConversationStatus } from "~/models/mongodb/conversation.model";
import { MessageModel, MessageType, SenderRole } from "~/models/mongodb/message.model";

import { getConversationRoom, HOST_ROOM } from "./socket.room";
import { ConversationServices } from "~/services/conversation.services";

interface SendMessagePayload {
  conversationId?: string, // cho optional để customer tạo mới
  content: string
  type?: MessageType
}

interface SocketAckResponse {
  success: boolean
  data?: any
  message?: string
}

export const registerMessageSocket = (io: Server, socket: Socket): void => {
  socket.on('message:send', async (payload: SendMessagePayload, callback?: (response: SocketAckResponse) => void) => {
    try {
      const user = socket.data.user
      if (!user) {
        return callback?.({ success: false, message: 'Unauthenticated' })
      }

      const { content, conversationId, type } = payload || {}
      if (!content || !content.trim()) {
        return callback?.({ success: false, message: 'Message content cannot be empty' })
      }

      const userRoleLower = user.role?.toLowerCase()
      const isCustomer = userRoleLower === SenderRole.CUSTOMER
      const isHost = userRoleLower === SenderRole.STAFF || userRoleLower === SenderRole.ADMIN

      if (!isCustomer && !isHost) {
        return callback?.({ success: false, message: 'Forbidden' })
      }

      let conversation: any = null
      let isNewConversation = false

      // 1. XỬ LÝ CONVERSATION
      if (conversationId) {
        conversation = await ConversationModel.findById(conversationId)
        if (!conversation || conversation.status === ConversationStatus.CLOSED) {
          return callback?.({ success: false, message: 'Conversation invalid or closed' })
        }
        if (isCustomer && String(conversation.customerId) !== String(user.user_id)) {
          return callback?.({ success: false, message: 'Forbidden: Access denied' })
        }
      } else {
        // Chưa có conversationId -> chỉ customer được tạo mới
        if (!isCustomer) {
          return callback?.({ success: false, message: 'Host must provide conversationId' })
        }
        const result = await ConversationServices.getOrCreateForCustomer(String(user.user_id))
        conversation = result.conversation
        isNewConversation = result.isNew
      }

      const currentConvId = String(conversation._id)
      const room = getConversationRoom(currentConvId)

      socket.join(room)

      // 2. LƯU MESSAGE
      let senderRole: SenderRole
      if (userRoleLower === SenderRole.ADMIN) senderRole = SenderRole.ADMIN
      else if (userRoleLower === SenderRole.STAFF) senderRole = SenderRole.STAFF
      else senderRole = SenderRole.CUSTOMER

      const newMessage = await MessageModel.create({
        conversationId: currentConvId,
        senderId: String(user.user_id),
        senderRole,
        content: content.trim(),
        type: type || MessageType.TEXT
      })

      const updatedConversation = await ConversationServices.updatedLastMessage(
        currentConvId,
        newMessage.content,
        String(user.user_id)
      )

      // 3. BROADCAST 1vs1 CHUẨN
      io.to(room).emit('message:new', newMessage)

      if (isNewConversation) {
        io.to(HOST_ROOM).emit('conversation:new', updatedConversation)
      } else {
        io.to(HOST_ROOM).emit('conversation:updated', updatedConversation)
      }

      callback?.({
        success: true,
        data: {
          conversationId: currentConvId,
          message: newMessage
        }
      })
      console.log(`[Message Sent] Room ${room} | Sender: ${user.user_id} (${senderRole})`)

    } catch (error) {
      console.error('[Socket Error] message:send:', error)
      callback?.({
        success: false,
        message: 'Internal server error while sending message'
      })
    }
  })
}
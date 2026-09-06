import { Server, Socket } from "socket.io"
import { getConversationRoom } from "../socket.room"
import { ConversationModel } from "~/models/mongodb/conversation.model"

interface TypingPayload {
  conversationId: string
}

const canAccessConversation = async (socket: Socket, conversationId: string) => {
  const user = socket.data.user
  if (!user) return false
  if (user.role === 'STAFF' || user.role === 'ADMIN') return true

  const ownerId = user.authType === 'TABLE_GUEST' ? user.tableId : user.user_id
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    customerId: ownerId
  }).select({ _id: 1 }).lean()
  return !!conversation
}

export const RegisterTypingSocket = (_io: Server, socket: Socket): void => {
  socket.on('typing:start', async (payload: TypingPayload) => {
    const user = socket.data.user
    const { conversationId } = payload || {}
    if (!conversationId || !user || !(await canAccessConversation(socket, conversationId))) return
    const room = getConversationRoom(conversationId)
    socket.to(room).emit('typing:start', {
      conversationId,
      userId: String(user.user_id),
      role: user.role
    })
  })

  socket.on('typing:stop', async (payload: TypingPayload) => {
    const user = socket.data.user
    const { conversationId } = payload || {}
    if (!conversationId || !user || !(await canAccessConversation(socket, conversationId))) return

    const room = getConversationRoom(conversationId)
    socket.to(room).emit('typing:stop', {
      conversationId,
      userId: String(user.user_id)
    })
  })
}
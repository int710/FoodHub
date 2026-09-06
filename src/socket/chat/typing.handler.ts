import { Server, Socket } from "socket.io"
import { getConversationRoom } from "../socket.room"

interface TypingPayload {
  conversationId: string
}

export const RegisterTypingSocket = (_io: Server, socket: Socket): void => {
  socket.on('typing:start', (payload: TypingPayload) => {
    const user = socket.data.user
    const { conversationId } = payload || {}
    if (!conversationId || !user) return
    const room = getConversationRoom(conversationId)
    socket.to(room).emit('typing:start', {
      conversationId,
      userId: String(user.user_id),
      role: user.role
    })
  })

  socket.on('typing:stop', (payload: TypingPayload) => {
    const user = socket.data.user
    const { conversationId } = payload || {}
    if (!conversationId || !user) return

    const room = getConversationRoom(conversationId)
    socket.to(room).emit('typing:stop', {
      conversationId,
      userId: String(user.user_id)
    })
  })
}
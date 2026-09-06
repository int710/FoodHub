import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { socketAuthMiddleware } from "./socket.middleware";
import { registerHostSocket } from "./chat/host.socket";
import { registerConversationSocket } from "./chat/conversation.socket";
import { registerMessageSocket } from "./chat/message.socket";
import { RegisterTypingSocket } from "./chat/typing.handler";
import { presenceManager } from "./chat/presence.manage";
import { setSocketIO } from "./socket.instance";
import { registerOrderSocket } from "./orders/order.socket";

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
  })
  setSocketIO(io)

  io.use(socketAuthMiddleware)

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`)
    const user = socket.data.user
    if (!user) return

    const userId = String(user.user_id)
    const isTrackedUser = user.authType === 'USER'
    const isNowOnline = isTrackedUser && presenceManager.addSocket(userId, socket.id)
    if (isNowOnline) {
      io.emit('user:online', { userId })
    }

    registerHostSocket(io, socket)
    registerConversationSocket(io, socket)
    registerMessageSocket(io, socket)
    RegisterTypingSocket(io, socket)

    registerOrderSocket(io, socket)

    socket.on('disconnect', (reason) => {
      const isNowOffline = isTrackedUser && presenceManager.removeSocket(userId, socket.id)
      if (isNowOffline) {
        io.emit('user:offline', { userId })
      }
      console.log(`Socket disconnected: ${socket.id} - ${reason}`)
    })

    socket.on('ping', (data) => {
      console.log(`Received ping: ${data}`)
      socket.emit('pong', {
        message: 'Hello from server',
        socketId: socket.id,
        data
      })
    })
  })

  return io
}
import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { socketAuthMiddleware } from "./socket.middleware";
import { registerHostSocket } from "./host.socket";
import { registerConversationSocket } from "./conversation.socket";
import { registerMessageSocket } from "./message.socket";
import { RegisterTypingSocket } from "./typing.handler";
import { presenceManager } from "./presence.manage";

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
  })

  io.use(socketAuthMiddleware)

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`)
    const user = socket.data.user
    if (!user) return

    const userId = String(user.user_id)
    const isNowOnline = presenceManager.addSocket(userId, socket.id)
    if (isNowOnline) {
      io.emit('user:online', { userId })
    }

    registerHostSocket(io, socket)
    registerConversationSocket(io, socket)
    registerMessageSocket(io, socket)
    RegisterTypingSocket(io, socket)

    socket.on('disconnect', (reason) => {
      const isNowOffline = presenceManager.removeSocket(userId, socket.id)
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
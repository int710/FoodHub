import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { socketAuthMiddleware } from "./socket.middleware";

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
    socket.on('disconnect', (reason) => {
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
import { Server, Socket } from "socket.io";
import { HOST_ROOM } from "./socket.room";


export const registerHostSocket = (_io: Server, socket: Socket) => {
  const user = socket.data.user
  if (!user) return
  const role = user.role?.toUpperCase()
  const isHost = role === 'STAFF' || role === 'ADMIN'
  if (isHost) {
    socket.join(HOST_ROOM)
    console.log(`[Socket] Host ${user.user_id} joined ${HOST_ROOM}`)
  }
}

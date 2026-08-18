import { Socket } from "socket.io";
import HTTP_STATUS from "~/constants/httpStatus";
import { ErrorWithStatus } from "~/models/Errors";
import { TokenPayloadSchema } from "~/models/schemas/token.schema";
import { verifyToken } from "~/utils/jwt";

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error | undefined) => void) => {
  try {
    const token = socket.handshake.auth?.token
    if (!token) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.UNAUTHORIZED, message: 'Authentication is required' })
    }
    const decoded_auth = await verifyToken({
      token,
      secretOrPrivateKey: process.env.SECRET_ACCESS_TOKEN as string,
      schema: TokenPayloadSchema
    })
    socket.data.user = decoded_auth
    console.log(socket.data.user)
    next()
  } catch (error) {
    return next(new Error('Invalid or expired token'))
  }
}
import { Socket } from "socket.io";
import HTTP_STATUS from "~/constants/httpStatus";
import { ErrorWithStatus } from "~/models/Errors";
import { TokenPayloadSchema } from "~/models/schemas/token.schema";
import { verifyToken } from "~/utils/jwt";
import { TokenType } from "~/constants/enums";

export interface SocketUserType {
  user_id: string;
  token_type: TokenType;
  isVerified: boolean;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
  email: string;
  iat?: number;
  exp?: number;
}

declare module "socket.io" {
  interface SocketData {
    user: SocketUserType;
  }
}

export class SocketAuthError extends Error {
  public data: { httpStatusCode: number };
  constructor(message: string, httpStatusCode: number = HTTP_STATUS.UNAUTHORIZED) {
    super(message);
    this.name = "SocketAuthError";
    this.data = { httpStatusCode };
  }
}

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      throw new SocketAuthError("Authentication token is required", HTTP_STATUS.UNAUTHORIZED);
    }
    const secretKey = process.env.SECRET_ACCESS_TOKEN;
    if (!secretKey) {
      throw new Error("SECRET_ACCESS_TOKEN is not defined in environment variables");
    }

    const decoded_auth = await verifyToken({
      token,
      secretOrPrivateKey: secretKey,
      schema: TokenPayloadSchema,
    });

    socket.data.user = decoded_auth as SocketUserType;
    next();
  } catch (error: any) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[Socket Auth Error]:", error.message || error);
    }

    if (error instanceof SocketAuthError) {
      return next(error);
    }
    return next(new SocketAuthError("Invalid or expired token", HTTP_STATUS.UNAUTHORIZED));
  }
};
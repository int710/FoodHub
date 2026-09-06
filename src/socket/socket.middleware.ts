import { Socket } from "socket.io";
import HTTP_STATUS from "~/constants/httpStatus";
import { ErrorWithStatus } from "~/models/Errors";
import { TableTokenPayloadSchema, TableTokenSessionPayload, TokenPayloadSchema } from "~/models/schemas/token.schema";
import { verifyToken } from "~/utils/jwt";
import { TokenType } from "~/constants/enums";
import { redis } from "~/config/redis";
import { RedisKey } from "~/constants/redis";

export interface SocketUserType {
  user_id: string;
  token_type: TokenType;
  isVerified: boolean;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
  email: string;
  iat?: number;
  exp?: number;
  authType: 'USER' | 'TABLE_GUEST';
  tableId?: string;
  sessionId?: string;
}

declare module "socket.io" {
  interface SocketData {
    user?: SocketUserType;
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
    const userToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
    const tableToken = socket.handshake.auth?.tableToken;

    if (tableToken) {
      const decodedTable = await verifyToken({
        token: tableToken,
        secretOrPrivateKey: process.env.SECRET_TABLE_TOKEN as string,
        schema: TableTokenPayloadSchema
      }) as TableTokenSessionPayload;
      const tableId = await redis.get(RedisKey.tableSession(decodedTable.sessionId));
      if (!tableId || tableId !== decodedTable.tableId) {
        throw new SocketAuthError('Invalid or expired table token', HTTP_STATUS.UNAUTHORIZED);
      }

      socket.data.user = {
        user_id: decodedTable.sessionId,
        token_type: TokenType.AccessToken,
        isVerified: false,
        role: 'CUSTOMER',
        email: '',
        authType: 'TABLE_GUEST',
        tableId: decodedTable.tableId,
        sessionId: decodedTable.sessionId
      };
      return next();
    }

    const token = userToken;

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

    socket.data.user = { ...(decoded_auth as SocketUserType), authType: 'USER' };
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
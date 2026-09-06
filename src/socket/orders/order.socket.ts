import { Server, Socket } from "socket.io";
import { ORDER_ROOMS } from "../socket.room";
import { ORDER_SOCKET_EVENTS } from "./order.constants";
import { prisma } from "~/config/prisma";


export async function verifyCustomerOrderAccess(userId: string, orderId: string): Promise<boolean> {
  if (!userId || !orderId) return false

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId: userId,
    },
    select: { id: true }
  })

  return !!order
}

export const registerOrderSocket = (_io: Server, socket: Socket): void => {
  const user = socket.data.user
  if (!user) return;

  if (user.role === 'ADMIN' || user.role === 'STAFF') {
    socket.join(ORDER_ROOMS.HOST_ORDERS)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OrderSocket] Host connected: ${user.role} (${user.user_id}) -> ${ORDER_ROOMS.HOST_ORDERS}`);
    }
  }

  socket.on(
    ORDER_SOCKET_EVENTS.JOIN,
    async (
      payload: { orderId: string },
      ack?: (res: { ok: boolean; message?: string }) => void
    ) => {
      try {
        const { orderId } = payload;
        if (!orderId) {
          return ack?.({ ok: false, message: 'orderId is required' })
        }
        if (user.role === 'CUSTOMER') {
          const isAllowed = await verifyCustomerOrderAccess(user.user_id, orderId);
          if (!isAllowed) {
            return ack?.({ ok: false, message: 'Unauthorized access to this order' });
          }
        }

        const roomName = ORDER_ROOMS.ORDER_DETAIL(orderId);
        socket.join(roomName)
        return ack?.({ ok: true });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Failed to join order room'

        return ack?.({ ok: false, message })
      }
    }
  );

  // Rời khỏi Room theo dõi Order
  socket.on(
    ORDER_SOCKET_EVENTS.LEAVE,
    (
      payload: { orderId: string },
      ack?: (res: { ok: boolean }) => void
    ) => {
      if (payload?.orderId) {
        socket.leave(ORDER_ROOMS.ORDER_DETAIL(payload.orderId));
      }
      return ack?.({ ok: true });
    }
  );
};
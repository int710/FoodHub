import { getSocketIO } from "../socket.instance";
import { ORDER_ROOMS } from "../socket.room";
import { ORDER_SOCKET_EVENTS } from "./order.constants";
import { OrderStatusUpdatePayload, OrderItemStatusUpdatePayload } from "./order.payload";

const emitToOrderRooms = (eventName: string, payload: any, orderId: string) => {
  const io = getSocketIO();
  const orderRoom = ORDER_ROOMS.ORDER_DETAIL(orderId);

  io.to(ORDER_ROOMS.HOST_ORDERS).emit(eventName, payload);
  io.to(orderRoom).emit(eventName, payload);
};

export const emitOrderStatusUpdate = (payload: OrderStatusUpdatePayload): void => {
  try {
    emitToOrderRooms(ORDER_SOCKET_EVENTS.STATUS_UPDATE, payload, payload.orderId);
  } catch (error) {
    console.error('[Socket Emitter Error] Failed to emit order status update:', error);
  }
};

export const emitNewOrder = (payload: {
  orderId: string
  orderCode: string
  orderType: string
  status: string
  createdAt: string
}): void => {
  try {
    getSocketIO().to(ORDER_ROOMS.HOST_ORDERS).emit(ORDER_SOCKET_EVENTS.NEW, payload)
  } catch (error) {
    console.error('[Socket Emitter Error] Failed to emit new order:', error)
  }
}

export const emitOrderItemStatusUpdate = (payload: OrderItemStatusUpdatePayload): void => {
  try {
    emitToOrderRooms(ORDER_SOCKET_EVENTS.ITEM_UPDATE, payload, payload.orderId);
  } catch (error) {
    console.error('[Socket Emitter Error] Failed to emit order item status update:', error);
  }
};

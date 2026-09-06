import { ItemStatus, OrderStatus, OrderType } from "~/generated/prisma/enums";
import { SocketUserType } from "../socket.middleware";

export interface OrderStatusUpdatePayload {
  orderId: string,
  orderType: OrderType,
  previousStatus: OrderStatus,
  status: OrderStatus,
  updatedAt: string,
  updatedBy?: {
    userId: string,
    role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  };
}

export interface OrderItemStatusUpdatePayload {
  orderId: string
  itemId: string
  previousStatus: ItemStatus
  status: ItemStatus
  updatedAt: string
  updatedBy?: {
    userId: string
    role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  }
}
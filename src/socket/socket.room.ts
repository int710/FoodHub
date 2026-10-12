export const HOST_ROOM = `host:room`
export const getConversationRoom = (conversationId: string): string => {
  return `conversation:${conversationId}`
}

export const ORDER_ROOMS = {
  HOST_ORDERS: 'host:orders',
  ORDER_DETAIL: (orderId: string) => `order:${orderId}`,
  TABLE_VISIT: (visitId: string) => `order:table-visit:${visitId}`,
} as const;

export const CART_ROOMS = {
  TABLE: (tableId: string) => `cart:table:${tableId}`
} as const

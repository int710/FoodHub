export const HOST_ROOM = `host:room`
export const getConversationRoom = (conversationId: string): string => {
  return `conversation:${conversationId}`
}

export const ORDER_ROOMS = {
  HOST_ORDERS: 'host:orders',
  ORDER_DETAIL: (orderId: string) => `order:${orderId}`,
} as const;
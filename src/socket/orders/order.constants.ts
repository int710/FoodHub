export const ORDER_SOCKET_EVENTS = {
  // server -> client
  NEW: 'order:new',
  STATUS_UPDATE: 'order:status:update',
  ITEM_UPDATE: 'order:item:update',
  READY: 'order:ready',
  CANCELLED: 'order:cancelled',

  // client -> server
  JOIN: 'order:join',
  LEAVE: 'order:leave'
} as const
export type OrderSocketEvent = (typeof ORDER_SOCKET_EVENTS)[keyof typeof ORDER_SOCKET_EVENTS]
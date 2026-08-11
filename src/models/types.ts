import { OrderType } from '~/generated/prisma/enums'
import { TableTokenSessionPayload, TokenPayload } from './schemas/token.schema'
import { CartItem } from './schemas/order.schema'

export interface TableTokenPayload {
  tableId: string
  name: string
  sessionId: `${string}-${string}-${string}-${string}-${string}`
}

export type DeliveryInfo = {
  fullName: string
  phone: string
  address: string
  note: string
}

export interface OrderContextRequest {
  user?: TokenPayload
  table?: TableTokenSessionPayload
  type: OrderType
  staffId?: string
}

export interface CartData {
  items: CartItem[]
  metadata: { tableId: string; createdAt: number; updatedAt: number; totalQuantity: number }
}

export type metadataType = {
  tableId: string
  createdAt: number
  updatedAt: number
  totalQuantity: number
}


export type CartContext = {
  type: OrderType
  ownerId: string
  tableId?: string
  userId?: string
  sessionId?: string
}
import { OrderType } from '~/generated/prisma/enums'
import { TableTokenSessionPayload, TokenPayload } from './schemas/token.schema'

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

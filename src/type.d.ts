import { TableTokenSessionPayload, TokenPayload } from './models/schemas/token.schema'
import { CartContext, OrderContextRequest } from './models/types'

declare global {
  namespace Express {
    interface Request {
      decoded_authorization?: TokenPayload
      decoded_tokenTableSession?: TableTokenSessionPayload
      order_context?: OrderContextRequest
      cart_context?: CartContext
    }
  }
}

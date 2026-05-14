import { TableTokenSessionPayload, TokenPayload } from './models/schemas/token.schema'

declare global {
  namespace Express {
    interface Request {
      decoded_authorization?: TokenPayload
      decoded_tokenTableSession?: TableTokenSessionPayload
    }
  }
}

import { TokenPayload } from './models/schemas/token.schema'

declare global {
  namespace Express {
    interface Request {
      decoded_authorization?: TokenPayload
    }
  }
}

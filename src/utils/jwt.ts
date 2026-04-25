import jwt, { SignOptions } from 'jsonwebtoken'
import HTTP_STATUS from '~/constants/httpStatus'
import { USER_MESSAGE } from '~/constants/message'
import { ErrorWithStatus } from '~/models/Errors'
import { TokenPayload, TokenPayloadSchema } from '~/models/schemas/token.schema'

export const signToken = ({
  payload,
  secretOrPrivateKey,
  options = {
    algorithm: 'RS256'
  }
}: {
  payload: string | object | Buffer<ArrayBufferLike>
  secretOrPrivateKey: string
  options: SignOptions
}) => {
  return new Promise((resolve, reject) => {
    jwt.sign(payload, secretOrPrivateKey, options, function (err, token) {
      if (err) {
        reject(err)
      }
      resolve(token)
    })
  })
}

export const verifyToken = ({ token, secretOrPrivateKey }: { token: string; secretOrPrivateKey: string }) => {
  return new Promise<TokenPayload>((resolve, reject) => {
    jwt.verify(token, secretOrPrivateKey, (err, decoded) => {
      if (err) return reject(err)

      // Validate runtime valid Token
      const result = TokenPayloadSchema.safeParse(decoded)
      if (result.error) {
        return reject(
          new ErrorWithStatus({
            httpStatusCode: HTTP_STATUS.UNAUTHORIZED,
            message: USER_MESSAGE.TOKEN_PAYLOAD_IS_INVALID
          })
        )
      }
      resolve(decoded as TokenPayload)
    })
  })
}

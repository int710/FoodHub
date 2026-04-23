import HTTP_STATUS from '~/constants/httpStatus'
import { SYSTEM_MESSAGE } from '~/constants/message'

export type ErrorsType = Record<
  string,
  {
    msg: string
    [key: string]: any
  }
>

export class ErrorWithStatus {
  httpStatusCode: number
  message: string
  constructor({ httpStatusCode, message }: { httpStatusCode: number; message: string }) {
    this.httpStatusCode = httpStatusCode
    this.message = message
  }
}

export class EntityError extends ErrorWithStatus {
  errors: ErrorsType
  constructor({ message = SYSTEM_MESSAGE.VALIDATION_ERROR, errors }: { message?: string; errors: ErrorsType }) {
    super({ message, httpStatusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY })
    this.errors = errors
  }
}

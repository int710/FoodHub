import { ZodError } from 'zod'
import { ErrorsType } from '~/models/Errors'

export const mapZodError = (err: ZodError) => {
  const errors: ErrorsType = {}
  err.issues.forEach((issue) => {
    const key = issue.path.join('.')
    if (!errors[key]) {
      errors[key] = { msg: issue.message }
    }
  })

  return errors
}

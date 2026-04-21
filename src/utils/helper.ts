import { ZodError } from 'zod'
import { ErrorsType } from '~/models/Errors'

export const mapZodError = (err: ZodError) => {
  console.log(err)
  const errors: ErrorsType = {}
  err.issues.forEach((issue) => {
    const key = issue.path.join('.')
    if (!errors[key]) {
      errors[key] = { msg: issue.message }
    }
  })

  return errors
}

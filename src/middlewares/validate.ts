import { NextFunction, Request, Response } from 'express'
import { ZodError, ZodType } from 'zod'
import { EntityError } from '~/models/Errors'
import { mapZodError } from '~/utils/helper'

export const validate = (schema: ZodType) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate body, query, params
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params
    })
    Object.assign(req, parsed)
    next()
  } catch (err) {
    console.log('Log error in validate', err)
    if (err instanceof ZodError) {
      return next(new EntityError({ errors: mapZodError(err) }))
    }

    return next(err)
  }
}

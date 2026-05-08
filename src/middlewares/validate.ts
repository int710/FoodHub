import { NextFunction, Request, Response } from 'express'
import { ZodError, ZodType } from 'zod'
import { EntityError } from '~/models/Errors'
import { mapZodError } from '~/utils/helper'

export const validate = (schema: ZodType) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate body, query, params
    const parsed = (await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params
    })) as Record<string, any>

    if (parsed.body) req.body = parsed.body
    if (parsed.query) Object.assign(req.query, parsed.query)
    if (parsed.params) Object.assign(req.params, parsed.params)
    next()
  } catch (err) {
    if (err instanceof ZodError) {
      return next(new EntityError({ errors: mapZodError(err) }))
    }

    return next(err)
  }
}

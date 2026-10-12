import { Router } from "express";
import reviewController from "~/controllers/review.controllers";
import { authenticate } from "~/middlewares/auth.middlewares";
import { validate } from "~/middlewares/validate";
import { createFeedbackSchema } from "~/models/schemas/review.schema";
import { requireRole } from "~/middlewares/rbac.middlewares";
import { requestHandler } from "~/utils/requestHandler";

const reviewRouter = Router()

// Express 5 exposes req.query through a getter. The controller normalizes this
// read-only query itself so the admin endpoint does not fail while applying defaults.
reviewRouter.get('/admin', authenticate, requireRole('ADMIN', 'STAFF'), requestHandler(reviewController.listAll))
reviewRouter.delete('/admin/:id', authenticate, requireRole('ADMIN'), requestHandler(reviewController.delete))
reviewRouter.get('/items/:menuItemId', reviewController.listByMenuItem)
reviewRouter.post('/feedback', authenticate, validate(createFeedbackSchema), requestHandler(reviewController.feedback))

export default reviewRouter

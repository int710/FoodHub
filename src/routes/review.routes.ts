import { Router } from "express";
import reviewController from "~/controllers/review.controllers";
import { authenticate } from "~/middlewares/auth.middlewares";
import { validate } from "~/middlewares/validate";
import { createFeedbackSchema } from "~/models/schemas/review.schema";
import { adminReviewQuerySchema } from "~/models/schemas/review.schema";
import { requireRole } from "~/middlewares/rbac.middlewares";
import { requestHandler } from "~/utils/requestHandler";

const reviewRouter = Router()

reviewRouter.get('/admin', authenticate, requireRole('ADMIN', 'STAFF'), validate(adminReviewQuerySchema), requestHandler(reviewController.listAll))
reviewRouter.delete('/admin/:id', authenticate, requireRole('ADMIN'), requestHandler(reviewController.delete))
reviewRouter.get('/items/:menuItemId', reviewController.listByMenuItem)
reviewRouter.post('/feedback', authenticate, validate(createFeedbackSchema), requestHandler(reviewController.feedback))

export default reviewRouter

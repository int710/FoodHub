import { Router } from "express";
import reviewController from "~/controllers/review.controllers";
import { authenticate } from "~/middlewares/auth.middlewares";
import { validate } from "~/middlewares/validate";
import { createFeedbackSchema } from "~/models/schemas/review.schema";

const reviewRouter = Router()

reviewRouter.get('/items/:menuItemId', reviewController.listByMenuItem)
reviewRouter.post('/feedback', authenticate, validate(createFeedbackSchema), reviewController.feedback)

export default reviewRouter
import { Request, Response } from "express"
import { CreateFeedbackDto } from "~/models/schemas/review.schema"
import { ParamsDictionary } from "express-serve-static-core";
import reviewsServices from "~/services/reviews.services";
import { ApiResponse } from "~/models/ApiResponse";

const reviewController = {
  async feedback(req: Request<ParamsDictionary, any, CreateFeedbackDto>, res: Response) {
    const customerId = req.decoded_authorization?.user_id as string
    const dto = req.body
    const review = await reviewsServices.createFeedback({ customerId, dto })

    return res.json(ApiResponse('Gửi đánh giá thành công, chúng tôi ghi nhận thông tin và xin cảm ơn !', review))
  },

  async listByMenuItem(req: Request<{ menuItemId: string }>, res: Response) {
    const { menuItemId } = req.params
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10

    const result = await reviewsServices.listByMenuItem(menuItemId, page, limit)
    return res.json(result)
  }
}

export default reviewController
import { Request, Response } from 'express'
import { ApiResponse } from '~/models/ApiResponse'
import mediaServices from '~/services/medias.services'

const mediasController = {
  async uploadImage(req: Request, res: Response) {
    const result = await mediaServices.handleUploadImage(req)
    return res.json(ApiResponse('Upload media image success', result))
  }
}

export default mediasController

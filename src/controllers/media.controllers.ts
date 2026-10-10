import { Request, Response } from 'express'
import { ApiResponse } from '~/models/ApiResponse'
import mediaServices from '~/services/medias.services'

const mediasController = {
  async getImage(req: Request<{ fileName: string }>, res: Response) {
    const result = await mediaServices.getImage(req.params.fileName)
    res.setHeader('Content-Type', result.contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    if (result.etag) res.setHeader('ETag', result.etag)
    return res.send(result.bytes)
  },

  async uploadImage(req: Request, res: Response) {
    const result = await mediaServices.handleUploadImage(req)
    return res.json(ApiResponse('Upload media image success', result))
  }
}

export default mediasController

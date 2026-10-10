import { Router } from 'express'
import mediasController from '~/controllers/media.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { requestHandler } from '~/utils/requestHandler'

const mediasRouter = Router()

mediasRouter.get('/file/:fileName', requestHandler(mediasController.getImage))
mediasRouter.post('/upload-image', authenticate, requestHandler(mediasController.uploadImage))

export default mediasRouter

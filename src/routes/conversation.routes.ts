import { Router } from 'express'
import { conversationController } from '~/controllers/conversation.controllers'
import { Role } from '~/generated/prisma/enums'
import { authenticate } from '~/middlewares/auth.middlewares'
import { requireRole } from '~/middlewares/rbac.middlewares'
import { requestHandler } from '~/utils/requestHandler'

const conversationRouter = Router()

conversationRouter.use(authenticate, requireRole(Role.ADMIN, Role.STAFF))
conversationRouter.get('/', requestHandler(conversationController.list))
conversationRouter.patch('/:id/close', requestHandler(conversationController.close))

export default conversationRouter

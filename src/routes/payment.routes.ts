import { Router } from 'express'
import paymentController from '~/controllers/payment.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { requireRole } from '~/middlewares/rbac.middlewares'
import { requestHandler } from '~/utils/requestHandler'


const paymentsRouter = Router()
paymentsRouter.post('/vnpay/create', requestHandler(paymentController.createPaymentUrl))
paymentsRouter.get('/vnpay/return', requestHandler(paymentController.paymentReturn))
paymentsRouter.get('/vnpay/ipn', requestHandler(paymentController.paymentIpn))
paymentsRouter.get('/vnpay/status/:orderCode', requestHandler(paymentController.paymentStatus))
paymentsRouter.get('/:orderId', requestHandler(paymentController.detailPayment))
paymentsRouter.patch(
  '/:orderId/cash-confirm',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  requestHandler(paymentController.cashConfirm)
)

export default paymentsRouter

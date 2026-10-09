import { Router } from 'express'
import paymentController from '~/controllers/payment.controllers'
import { authenticate } from '~/middlewares/auth.middlewares'
import { requireRole } from '~/middlewares/rbac.middlewares'
import { requestHandler } from '~/utils/requestHandler'
import zalopayController from '~/controllers/zalopay.controllers'


const paymentsRouter = Router()
paymentsRouter.post('/vnpay/create', requestHandler(paymentController.createPaymentUrl))
paymentsRouter.get('/vnpay/return', requestHandler(paymentController.paymentReturn))
paymentsRouter.get('/vnpay/ipn', requestHandler(paymentController.paymentIpn))
paymentsRouter.get('/vnpay/status/:orderCode', requestHandler(paymentController.paymentStatus))
paymentsRouter.post('/zalopay/create', requestHandler(zalopayController.createPaymentUrl))
paymentsRouter.post('/zalopay/callback', requestHandler(zalopayController.callback))
paymentsRouter.get('/zalopay/return', requestHandler(zalopayController.paymentReturn))
paymentsRouter.get('/zalopay/status/:orderCode', requestHandler(zalopayController.paymentStatus))
paymentsRouter.patch(
  '/:orderId/zalopay/convert',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  requestHandler(zalopayController.convertCashToZalopay)
)
paymentsRouter.get('/:orderId', requestHandler(paymentController.detailPayment))
paymentsRouter.patch(
  '/:orderId/cash-confirm',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  requestHandler(paymentController.cashConfirm)
)

export default paymentsRouter

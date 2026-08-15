import { Router } from "express";
import paymentController from "~/controllers/payment.controllers";
import { authenticate } from "~/middlewares/auth.middlewares";
import { requireRole } from "~/middlewares/rbac.middlewares";


const paymentsRouter = Router()
paymentsRouter.post('/vnpay/create', paymentController.createPaymentUrl)
paymentsRouter.get('/vnpay/return', paymentController.paymentReturn)
paymentsRouter.get('/vnpay/ipn', paymentController.paymentIpn) // khai báo với VNPay
paymentsRouter.get('/:orderId', paymentController.detailPayment)
paymentsRouter.patch('/:orderId/cash-confirm', authenticate, requireRole("ADMIN", "STAFF"), paymentController.cashConfirm)

export default paymentsRouter
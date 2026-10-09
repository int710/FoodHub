import { Request, Response } from 'express'
import { Prisma } from '~/generated/prisma/client'
import { OrderStatus, OrderType, PaymentMethod, PaymentStatus } from '~/generated/prisma/enums'
import { prisma } from '~/config/prisma'
import { vnpay } from '~/config/vnpay'
import cartsServices, { CartType } from '~/services/carts.services'

import {
  IpnFailChecksum,
  IpnInvalidAmount,
  IpnOrderNotFound,
  IpnSuccess,
  InpOrderAlreadyConfirmed,
  IpnUnknownError
} from 'vnpay/constants'
import type { ReturnQueryFromVNPay } from 'vnpay/types'
import { ApiResponse } from '~/models/ApiResponse'
import paymentServices from '~/services/payments.services'
import notificationsServices from '~/services/notifications.services'
import { emitOrderStatusUpdate } from '~/socket/orders/order.emitter'
import { buildVnpayPaymentUrl, getClientIp, VNPAY_PAYMENT_TIMEOUT_MS } from '~/utils/vnpay-payment'
import { expireStalePaymentOrders } from '~/services/order-expiration.services'

const mapOrderTypeToCartType = (type: OrderType): CartType => {
  if (type === OrderType.DINE_IN) return CartType.DINE_IN
  if (type === OrderType.TAKEAWAY) return CartType.TAKEAWAY
  return CartType.DELIVERY
}

const isSuccessfulVnpayResult = (result: ReturnType<typeof vnpay.verifyIpnCall>) => {
  return (
    result.isVerified &&
    String(result.vnp_ResponseCode) === '00' &&
    String(result.vnp_TransactionStatus) === '00'
  )
}

const buildAndroidDeepLink = (result: ReturnType<typeof vnpay.verifyReturnUrl>) => {
  const deepLinkBase = process.env.ANDROID_PAYMENT_DEEP_LINK || 'foodhub://payment/result'

  const deepLink = new URL(deepLinkBase)
  const gatewaySuccess = isSuccessfulVnpayResult(result)

  deepLink.searchParams.set('orderCode', String(result.vnp_TxnRef || ''))
  deepLink.searchParams.set('result', gatewaySuccess ? 'processing' : 'failed')
  deepLink.searchParams.set('responseCode', String(result.vnp_ResponseCode || ''))

  if (!result.isVerified) deepLink.searchParams.set('reason', 'invalid_checksum')
  return deepLink.toString()
}

const paymentController = {
  async createPaymentUrl(req: Request, res: Response) {
    const { orderCode } = req.body as { orderCode?: string }

    if (!orderCode) {
      return res.status(400).json({ message: 'Thiếu orderCode' })
    }

    let order = await prisma.order.findUnique({
      where: { orderCode },
      include: { payments: true }
    })

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn' })
    }

    await expireStalePaymentOrders(order.id)
    order = await prisma.order.findUnique({
      where: { orderCode },
      include: { payments: true }
    })
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn' })

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return res.status(400).json({
        message: `Đơn đang ở trạng thái ${order.status}, không thể tạo lại link`
      })
    }

    const payment = order.payments.find((item) => item.method === PaymentMethod.VNPAY)
    if (!payment || payment.status !== PaymentStatus.PENDING) {
      return res.status(400).json({ message: 'Giao dịch VNPay của đơn không còn ở trạng thái chờ' })
    }

    // Link mới có vnp_ExpireDate mới, nên hạn trong DB phải được gia hạn cùng lúc.
    await prisma.order.update({
      where: { id: order.id },
      data: { expireAt: new Date(Date.now() + VNPAY_PAYMENT_TIMEOUT_MS) }
    })

    const paymentUrl = buildVnpayPaymentUrl({
      amount: Number(order.totalAmount.toString()),
      orderCode: order.orderCode,
      clientIp: getClientIp(req)
    })

    return res.json({
      message: 'Tạo URL thành công',
      paymentUrl,
      orderCode
    })
  },

  async paymentReturn(req: Request, res: Response) {
    const verify = vnpay.verifyReturnUrl(req.query as ReturnQueryFromVNPay)
    const androidDeepLink = buildAndroidDeepLink(verify)

    if (androidDeepLink) {
      return res.redirect(androidDeepLink)
    }

    // Fallback JSON để kiểm thử khi chưa cấu hình deep link Android.
    if (!process.env.FE_URL) {
      return res.json({
        isVerified: verify.isVerified,
        isSuccess: isSuccessfulVnpayResult(verify),
        orderCode: verify.vnp_TxnRef,
        responseCode: verify.vnp_ResponseCode,
        transactionStatus: verify.vnp_TransactionStatus,
        message: verify.message
      })
    }

    if (!verify.isVerified) {
      return res.redirect(`${process.env.FE_URL}/payment/failed?reason=invalid_checksum`)
    }
    if (!isSuccessfulVnpayResult(verify)) {
      return res.redirect(`${process.env.FE_URL}/payment/failed?orderCode=${verify.vnp_TxnRef}&code=${verify.vnp_ResponseCode}`)
    }
    return res.redirect(`${process.env.FE_URL}/payment/success?orderCode=${verify.vnp_TxnRef}`)
  },

  async paymentIpn(req: Request, res: Response) {
    try {
      const verify = vnpay.verifyIpnCall(req.query as ReturnQueryFromVNPay)

      if (!verify.isVerified) {
        return res.status(200).json(IpnFailChecksum)
      }

      const order = await prisma.order.findUnique({
        where: { orderCode: verify.vnp_TxnRef as string }
      })

      if (!order) {
        return res.status(200).json(IpnOrderNotFound)
      }

      const payment = await prisma.payment.findFirst({
        where: { orderId: order.id, method: PaymentMethod.VNPAY }
      })

      if (!payment) {
        return res.status(200).json(IpnOrderNotFound)
      }

      if (Number(order.totalAmount.toString()) !== Number(verify.vnp_Amount)) {
        return res.status(200).json(IpnInvalidAmount)
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT || payment.status !== PaymentStatus.PENDING) {
        return res.status(200).json(InpOrderAlreadyConfirmed)
      }

      if (isSuccessfulVnpayResult(verify)) {
        const paidAt = new Date()
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.PENDING_CONFIRMATION,
              paidAt,
              expireAt: null
            }
          })

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.PAID,
              txnRef: verify.vnp_TxnRef as string,
              gatewayData: req.query as Prisma.InputJsonValue,
              paidAt
            }
          })
        })

        emitOrderStatusUpdate({
          orderId: order.id,
          orderType: order.type,
          previousStatus: OrderStatus.PENDING_PAYMENT,
          status: OrderStatus.PENDING_CONFIRMATION,
          updatedAt: paidAt.toISOString()
        })

        await notificationsServices.createOrderStatusNotification({
          orderId: order.id,
          previousStatus: OrderStatus.PENDING_PAYMENT,
          status: OrderStatus.PENDING_CONFIRMATION
        }).catch((error) => {
          console.error('[Notification] Failed to create payment success notification:', error)
        })
        await notificationsServices.createOrderCreated(order.id).catch((error) => {
          console.error('[Notification] Failed to create paid order notification:', error)
        })

        try {
          const cartType = mapOrderTypeToCartType(order.type)
          const cartOwnerId =
            order.type === OrderType.DINE_IN
              ? order.tableId
              : order.customerId || order.sessionId

          if (cartOwnerId) await cartsServices.clearCart(cartType, cartOwnerId)
        } catch (error) {
          console.error('Clear cart after payment failed:', error)
        }

        return res.status(200).json(IpnSuccess)
      }

      const failedAt = new Date()
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAYMENT_FAILED }
        })

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            gatewayData: req.query as Prisma.InputJsonValue
          }
        })
      })

      emitOrderStatusUpdate({
        orderId: order.id,
        orderType: order.type,
        previousStatus: OrderStatus.PENDING_PAYMENT,
        status: OrderStatus.PAYMENT_FAILED,
        updatedAt: failedAt.toISOString()
      })

      await notificationsServices.createOrderStatusNotification({
        orderId: order.id,
        previousStatus: OrderStatus.PENDING_PAYMENT,
        status: OrderStatus.PAYMENT_FAILED
      }).catch((error) => {
        console.error('[Notification] Failed to create payment failure notification:', error)
      })

      return res.status(200).json(IpnSuccess)
    } catch (error) {
      console.error('IPN error', error)
      return res.status(200).json(IpnUnknownError)
    }
  },

  async paymentStatus(req: Request<{ orderCode: string }>, res: Response) {
    const current = await prisma.order.findUnique({
      where: { orderCode: req.params.orderCode },
      select: { id: true }
    })
    if (!current) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' })
    await expireStalePaymentOrders(current.id)

    const order = await prisma.order.findUnique({
      where: { orderCode: req.params.orderCode },
      select: {
        id: true,
        orderCode: true,
        status: true,
        paidAt: true,
        updatedAt: true,
        payments: {
          where: { method: PaymentMethod.VNPAY },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, paidAt: true }
        }
      }
    })

    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' })

    const payment = order.payments[0]
    return res.json(
      ApiResponse('Trạng thái thanh toán', {
        orderId: order.id,
        orderCode: order.orderCode,
        orderStatus: order.status,
        paymentStatus: payment?.status || null,
        paidAt: payment?.paidAt || order.paidAt,
        updatedAt: order.updatedAt,
        shouldPoll:
          order.status === OrderStatus.PENDING_PAYMENT && payment?.status === PaymentStatus.PENDING
      })
    )
  },

  async detailPayment(req: Request<{ orderId: string }>, res: Response) {
    const { orderId } = req.params
    const result = await paymentServices.detailPayment(orderId)
    return res.json(ApiResponse('Chi tiết thanh toán hóa đơn', result))
  },

  async cashConfirm(req: Request<{ orderId: string }>, res: Response) {
    const { orderId } = req.params
    const staffId = req.decoded_authorization?.user_id as string

    const data = await paymentServices.cashConfirm({ orderId, staffId })
    await notificationsServices.createOrderStatusNotification({
      orderId,
      previousStatus: OrderStatus.PENDING_CONFIRMATION,
      status: OrderStatus.CONFIRMED
    }).catch((error) => {
      console.error('[Notification] Failed to create cash confirmation notification:', error)
    })
    return res.json(ApiResponse('Xác nhận thanh toán thành công', data))
  }

}

export default paymentController

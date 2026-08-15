import { Request, Response } from 'express'
import { Prisma } from '~/generated/prisma/client'
import { OrderStatus, OrderType, PaymentStatus } from '~/generated/prisma/enums'
import { prisma } from '~/config/prisma'
import { vnpay } from '~/config/vnpay'
import cartsServices, { CartType } from '~/services/carts.services'

import { ProductCode, VnpLocale } from 'vnpay/enums'
import { dateFormat } from 'vnpay/utils'
import {
  IpnFailChecksum,
  IpnInvalidAmount,
  IpnOrderNotFound,
  IpnSuccess,
  InpOrderAlreadyConfirmed
} from 'vnpay/constants'
import type { ReturnQueryFromVNPay } from 'vnpay/types'
import { ApiResponse } from '~/models/ApiResponse'
import paymentServices from '~/services/payments.services'

const mapOrderTypeToCartType = (type: OrderType): CartType => {
  if (type === OrderType.DINE_IN) return CartType.DINE_IN
  if (type === OrderType.TAKEAWAY) return CartType.TAKEAWAY
  return CartType.DELIVERY
}

const getClientIp = (req: Request): string => {
  let ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1'

  ip = ip.replace(/^::ffff:/, '')
  if (ip === '::1' || ip.includes(':')) ip = '127.0.0.1'

  return ip
}

const paymentController = {
  async createPaymentUrl(req: Request, res: Response) {
    const { orderCode } = req.body as { orderCode?: string }

    if (!orderCode) {
      return res.status(400).json({ message: 'Thiếu orderCode' })
    }

    const order = await prisma.order.findFirst({
      where: { orderCode },
      include: { payments: true }
    })

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn' })
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return res.status(400).json({
        message: `Đơn đang ở trạng thái ${order.status}, không thể tạo lại link`
      })
    }

    const paymentUrl = vnpay.buildPaymentUrl({
      vnp_Amount: Number(order.totalAmount.toString()),
      vnp_IpAddr: getClientIp(req),
      vnp_TxnRef: order.orderCode,
      vnp_OrderInfo: `Thanh toan FoodHub ${order.orderCode}`,
      vnp_OrderType: ProductCode.Other,
      vnp_ReturnUrl: process.env.VNPAY_RETURN_URL!,
      vnp_Locale: VnpLocale.VN,
      vnp_CreateDate: dateFormat(new Date()),
      vnp_ExpireDate: dateFormat(new Date(Date.now() + 15 * 60 * 1000))
    })

    return res.json({
      message: 'Tạo URL thành công',
      paymentUrl,
      orderCode
    })
  },

  async paymentReturn(req: Request, res: Response) {
    const verify = vnpay.verifyReturnUrl(req.query as ReturnQueryFromVNPay)

    // Nếu chưa có FE thì trả JSON luôn cho dễ test
    if (!process.env.FE_URL) {
      return res.json({
        isVerified: verify.isVerified,
        isSuccess: verify.isSuccess,
        orderCode: verify.vnp_TxnRef,
        message: verify.message
      })
    }

    if (!verify.isVerified) {
      return res.redirect(`${process.env.FE_URL}/payment/failed?reason=invalid_checksum`)
    }
    if (!verify.isSuccess) {
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

      const order = await prisma.order.findFirst({
        where: { orderCode: verify.vnp_TxnRef as string }
      })

      if (!order) {
        return res.status(200).json(IpnOrderNotFound)
      }

      const payment = await prisma.payment.findFirst({
        where: { orderId: order.id }
      })

      if (!payment) {
        return res.status(200).json(IpnOrderNotFound)
      }

      // log ra để check
      console.log('CHECK AMOUNT', {
        orderAmount: Number(order.totalAmount.toString()),
        vnpAmount: verify.vnp_Amount,
        txnRef: verify.vnp_TxnRef
      })

      if (Number(order.totalAmount.toString()) !== Number(verify.vnp_Amount)) {
        return res.status(200).json(IpnInvalidAmount)
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        return res.status(200).json(InpOrderAlreadyConfirmed)
      }

      if (verify.isSuccess && verify.vnp_ResponseCode === '00') {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.PENDING_CONFIRMATION,
              paidAt: new Date(),
              expireAt: null
            }
          })

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.PAID,
              txnRef: verify.vnp_TxnRef as string,
              gatewayData: req.query as Prisma.InputJsonValue,
              paidAt: new Date()
            }
          })
        })

        try {
          const cartType = mapOrderTypeToCartType(order.type)
          await cartsServices.clearCart(cartType, order.customerId || order.sessionId)
        } catch (error) {
          console.error('Clear cart after payment failed:', error)
        }

        return res.status(200).json(IpnSuccess)
      }

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

      return res.status(200).json(IpnSuccess)
    } catch (error) {
      console.error('IPN error', error)
      return res.status(200).json(IpnFailChecksum)
    }
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
    return res.json(ApiResponse('Xác nhận thanh toán thành công', data))
  }

}

export default paymentController
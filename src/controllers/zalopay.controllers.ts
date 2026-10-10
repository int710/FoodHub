import { Request, Response } from 'express'
import { prisma } from '~/config/prisma'
import HTTP_STATUS from '~/constants/httpStatus'
import { Prisma } from '~/generated/prisma/client'
import { OrderStatus, PaymentMethod, PaymentStatus } from '~/generated/prisma/enums'
import { ApiResponse } from '~/models/ApiResponse'
import { ErrorWithStatus } from '~/models/Errors'
import {
  createZaloPayOrder,
  createZaloPayTransactionId,
  isCurrentZaloPaymentMode,
  verifyZaloPayCallback,
  verifyZaloPayRedirect,
  ZALOPAY_PAYMENT_TIMEOUT_MS
} from '~/services/zalopay.services'
import {
  asGatewayObject,
  reconcileZaloPayment,
  settleZaloPaymentFailure,
  settleZaloPaymentSuccess
} from '~/services/zalopay-payment-state.services'

async function findZaloOrder(orderCode: string) {
  const order = await prisma.order.findUnique({
    where: { orderCode },
    include: {
      payments: { orderBy: { createdAt: 'desc' } },
      items: { select: { menuItemId: true, quantity: true, unitPrice: true, snapshot: true } }
    }
  })
  if (!order) {
    throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đơn hàng' })
  }
  const payment = order.payments.find((item) => item.method === PaymentMethod.ZALOPAY)
  if (!payment) {
    throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.BAD_REQUEST, message: 'Đơn không sử dụng ZaloPay' })
  }
  return { order, payment }
}

const zalopayController = {
  async createPaymentUrl(req: Request, res: Response) {
    const orderCode = String(req.body?.orderCode || '').trim()
    if (!orderCode) throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.BAD_REQUEST, message: 'Thiếu orderCode' })

    const { order, payment } = await findZaloOrder(orderCode)
    if (payment.status !== PaymentStatus.PENDING || order.status === OrderStatus.CANCELLED || order.status === OrderStatus.COMPLETED) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: `Giao dịch ZaloPay đang ở trạng thái ${payment.status}`
      })
    }

    if (payment.txnRef && order.expireAt && order.expireAt <= new Date()) {
      const reconciled = await reconcileZaloPayment(payment, order)
      if (reconciled.paymentStatus !== PaymentStatus.PENDING) {
        throw new ErrorWithStatus({
          httpStatusCode: HTTP_STATUS.CONFLICT,
          message: reconciled.restoredCash
            ? 'Giao dịch ZaloPay đã hết hạn; đơn đã trở lại thanh toán tiền mặt'
            : `Giao dịch ZaloPay đang ở trạng thái ${reconciled.paymentStatus}`
        })
      }
    }

    const gateway = asGatewayObject(payment.gatewayData)
    const storedUrl = typeof gateway.orderUrl === 'string' ? gateway.orderUrl : null
    if (storedUrl && isCurrentZaloPaymentMode(gateway)) {
      return res.json(ApiResponse('URL ZaloPay hiện tại', {
        orderCode,
        paymentUrl: storedUrl,
        orderUrl: storedUrl,
        qrCode: typeof gateway.qrCode === 'string' ? gateway.qrCode : null,
        provider: PaymentMethod.ZALOPAY
      }))
    }

    const result = await createZaloPayOrder({
      orderCode,
      amount: Number(order.totalAmount.toString()),
      appUser: order.customerId || order.sessionId,
      appTransId: storedUrl
        ? createZaloPayTransactionId(`${orderCode}${Date.now().toString().slice(-6)}`)
        : payment.txnRef || createZaloPayTransactionId(orderCode)
    })
    const expireAt = new Date(Date.now() + ZALOPAY_PAYMENT_TIMEOUT_MS)
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { expireAt } }),
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          txnRef: result.appTransId,
          gatewayData: {
            ...gateway,
            orderUrl: result.orderUrl,
            qrCode: result.qrCode,
            zpTransToken: result.zpTransToken,
            orderToken: result.orderToken,
            preferredPaymentMethod: result.preferredPaymentMethod,
            createResponse: result.raw
          } as Prisma.InputJsonValue
        }
      })
    ])
    return res.json(ApiResponse('Tạo URL ZaloPay thành công', {
      orderCode,
      paymentUrl: result.orderUrl,
      orderUrl: result.orderUrl,
      qrCode: result.qrCode,
      provider: PaymentMethod.ZALOPAY
    }))
  },

  async callback(req: Request, res: Response) {
    try {
      const data = typeof req.body?.data === 'string' ? req.body.data : ''
      const mac = typeof req.body?.mac === 'string' ? req.body.mac : ''
      const callback = verifyZaloPayCallback(data, mac)
      if (!callback) return res.status(200).json({ return_code: -1, return_message: 'mac not equal' })

      const payment = await prisma.payment.findUnique({
        where: { txnRef: callback.app_trans_id },
        include: { order: true }
      })
      if (!payment || payment.method !== PaymentMethod.ZALOPAY) {
        return res.status(200).json({ return_code: 0, return_message: 'order not found' })
      }
      if (payment.status === PaymentStatus.PAID) {
        return res.status(200).json({ return_code: 2, return_message: 'order already confirmed' })
      }

      await settleZaloPaymentSuccess(payment, payment.order, callback.amount, callback as unknown as Record<string, unknown>)
      return res.status(200).json({ return_code: 1, return_message: 'success' })
    } catch (error) {
      console.error('[ZaloPay] callback error:', error)
      return res.status(200).json({
        return_code: 0,
        return_message: error instanceof Error ? error.message : 'internal error'
      })
    }
  },

  async paymentReturn(req: Request, res: Response) {
    const query = req.query as Record<string, unknown>
    const verified = verifyZaloPayRedirect(query)
    const deepLink = new URL(process.env.ZALOPAY_ANDROID_DEEP_LINK?.trim() || 'foodhub://payment/result')
    deepLink.searchParams.set('provider', 'zalopay')
    const appTransId = String(query.apptransid || '')
    const payment = appTransId
      ? await prisma.payment.findUnique({ where: { txnRef: appTransId }, select: { order: { select: { orderCode: true } } } })
      : null
    deepLink.searchParams.set('orderCode', payment?.order.orderCode || appTransId)
    deepLink.searchParams.set('result', verified && String(query.status) === '1' ? 'processing' : 'failed')
    deepLink.searchParams.set('responseCode', String(query.status || ''))
    if (!verified) deepLink.searchParams.set('reason', 'invalid_checksum')
    return res.redirect(deepLink.toString())
  },

  async paymentStatus(req: Request<{ orderCode: string }>, res: Response) {
    const { order, payment } = await findZaloOrder(req.params.orderCode)
    let orderStatus = order.status
    let paymentStatus = payment.status
    let restoredCash = false
    let paidAt = payment.paidAt || order.paidAt

    if (payment.status === PaymentStatus.PENDING && payment.txnRef) {
      const result = await reconcileZaloPayment(payment, order)
      orderStatus = result.orderStatus
      paymentStatus = result.paymentStatus
      restoredCash = result.restoredCash
      if ('paidAt' in result && result.paidAt instanceof Date) paidAt = result.paidAt
    }

    const gateway = asGatewayObject(payment.gatewayData)
    return res.json(ApiResponse('Trạng thái thanh toán ZaloPay', {
      orderId: order.id,
      orderCode: order.orderCode,
      provider: restoredCash ? PaymentMethod.CASH : PaymentMethod.ZALOPAY,
      orderStatus,
      paymentStatus,
      paidAt,
      shouldPoll: paymentStatus === PaymentStatus.PENDING,
      restoredCash,
      paymentUrl: typeof gateway.orderUrl === 'string' ? gateway.orderUrl : null,
      qrCode: typeof gateway.qrCode === 'string' ? gateway.qrCode : null
    }))
  },

  async convertCashToZalopay(req: Request<{ orderId: string }>, res: Response) {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        items: { select: { menuItemId: true, quantity: true, unitPrice: true, snapshot: true } }
      }
    })
    if (!order) throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đơn hàng' })
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.PAYMENT_FAILED
    ) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.BAD_REQUEST, message: 'Đơn đã kết thúc, không thể đổi thanh toán' })
    }

    let payment = order.payments[0]
    if (payment?.method === PaymentMethod.ZALOPAY && payment.status === PaymentStatus.PENDING) {
      const gateway = asGatewayObject(payment.gatewayData)
      const storedUrl = typeof gateway.orderUrl === 'string' ? gateway.orderUrl : null

      if (order.expireAt && order.expireAt <= new Date() && payment.txnRef) {
        const reconciled = await reconcileZaloPayment(payment, order)
        if (reconciled.paymentStatus === PaymentStatus.PAID) {
          throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.CONFLICT, message: 'Đơn đã thanh toán ZaloPay' })
        }
        if (reconciled.restoredCash) {
          payment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
        } else if (storedUrl) {
          return res.json(ApiResponse('Mở lại QR ZaloPay đang chờ thanh toán', {
            orderId: order.id,
            orderCode: order.orderCode,
            orderStatus: order.status,
            paymentStatus: PaymentStatus.PENDING,
            paymentUrl: storedUrl,
            orderUrl: storedUrl,
            qrCode: typeof gateway.qrCode === 'string' ? gateway.qrCode : null,
            expireAt: order.expireAt
          }))
        }
      } else if (storedUrl) {
        return res.json(ApiResponse('Mở lại QR ZaloPay đang chờ thanh toán', {
          orderId: order.id,
          orderCode: order.orderCode,
          orderStatus: order.status,
          paymentStatus: PaymentStatus.PENDING,
          paymentUrl: storedUrl,
          orderUrl: storedUrl,
          qrCode: typeof gateway.qrCode === 'string' ? gateway.qrCode : null,
          expireAt: order.expireAt
        }))
      }
    }
    const canCreateZalo = payment && (
      (payment.method === PaymentMethod.CASH && payment.status === PaymentStatus.UNPAID) ||
      (payment.method === PaymentMethod.ZALOPAY && payment.status === PaymentStatus.PENDING)
    )
    if (!payment || !canCreateZalo) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.CONFLICT,
        message: 'Chỉ có thể chuyển đơn tiền mặt chưa thanh toán sang ZaloPay'
      })
    }

    const appTransId = createZaloPayTransactionId(`${order.orderCode}${Date.now().toString().slice(-5)}`)
    const expireAt = new Date(Date.now() + ZALOPAY_PAYMENT_TIMEOUT_MS)
    const previousGateway = asGatewayObject(payment.gatewayData)
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { expireAt } }),
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          method: PaymentMethod.ZALOPAY,
          status: PaymentStatus.PENDING,
          txnRef: appTransId,
          gatewayData: {
            ...previousGateway,
            convertedFromCash: true,
            convertedById: req.decoded_authorization?.user_id,
            convertedAt: new Date().toISOString()
          }
        }
      })
    ])

    try {
      const result = await createZaloPayOrder({
        orderCode: order.orderCode,
        amount: Number(order.totalAmount.toString()),
        appUser: order.customerId || order.sessionId,
        appTransId,
        items: order.items.map((item) => ({
          itemid: item.menuItemId,
          itemname: asGatewayObject(item.snapshot).name || item.menuItemId,
          itemprice: Number(item.unitPrice.toString()),
          itemquantity: item.quantity
        }))
      })
      const gatewayData = {
        convertedFromCash: true,
        convertedById: req.decoded_authorization?.user_id,
        convertedAt: new Date().toISOString(),
        orderUrl: result.orderUrl,
        qrCode: result.qrCode,
        zpTransToken: result.zpTransToken,
        orderToken: result.orderToken,
        preferredPaymentMethod: result.preferredPaymentMethod,
        createResponse: result.raw
      }
      await prisma.payment.update({
        where: { id: payment.id },
        data: { gatewayData: gatewayData as Prisma.InputJsonValue }
      })

      return res.json(ApiResponse('Đã chuyển đơn tiền mặt sang ZaloPay', {
        orderId: order.id,
        orderCode: order.orderCode,
        orderStatus: order.status,
        paymentStatus: PaymentStatus.PENDING,
        paymentUrl: result.orderUrl,
        orderUrl: result.orderUrl,
        qrCode: result.qrCode,
        expireAt
      }))
    } catch (error) {
      await settleZaloPaymentFailure(
        { id: payment.id, gatewayData: { convertedFromCash: true } },
        order,
        'CREATE_FAILED',
        { message: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_GATEWAY,
        message: error instanceof Error ? error.message : 'Không thể kết nối ZaloPay'
      })
    }
  }
}

export default zalopayController

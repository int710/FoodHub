import { error } from "node:console"
import { prisma } from "~/config/prisma"
import HTTP_STATUS from "~/constants/httpStatus"
import { OrderStatus, PaymentMethod, PaymentStatus } from "~/generated/prisma/enums"
import { ErrorWithStatus } from "~/models/Errors"

class PaymentServices {
  async detailPayment(orderId: string) {
    const data = await prisma.payment.findFirst({
      where: { orderId },
      select: { orderId: true, method: true, status: true, amount: true, paidAt: true, createdAt: true }
    })
    return data
  }

  async cashConfirm({ orderId, staffId }: { orderId: string, staffId: string }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true }
    })

    if (!order || !order.payments.length) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Đơn hàng không tồn tại'
      })
    }

    const orderPayment = order.payments[0] // lấy phần tử đầu

    if (orderPayment.method !== PaymentMethod.CASH) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Đơn này không phải tiền mặt'
      })
    }

    if (order.status !== OrderStatus.PENDING_CONFIRMATION) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: `Đơn đang ở trạng thái ${order.status}`
      })
    }

    const paidAt = new Date()

    return prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED, paidAt, confirmedById: staffId }
      })

      await tx.payment.update({
        where: { id: orderPayment.id },
        data: {
          status: PaymentStatus.PAID,
          paidAt,
          gatewayData: {
            ...(orderPayment.gatewayData as any),
            confirmCashById: staffId,
            confirmedAt: paidAt.toISOString()
          }
        }
      })
    })
  }
}

const paymentServices = new PaymentServices()
export default paymentServices
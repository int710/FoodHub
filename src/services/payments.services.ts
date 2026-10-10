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

    if (order.status !== OrderStatus.SERVED) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Chỉ xác nhận thu tiền mặt sau khi đơn đã được phục vụ'
      })
    }

    if (orderPayment.status === PaymentStatus.PAID) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Đơn hàng đã được thanh toán'
      })
    }

    const paidAt = new Date()

    return prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { paidAt },
        select: { id: true, type: true, status: true }
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
      return { ...updatedOrder, paidAt }
    })
  }
}

const paymentServices = new PaymentServices()
export default paymentServices

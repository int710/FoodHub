import { prisma } from "~/config/prisma"
import HTTP_STATUS from "~/constants/httpStatus"
import { OrderStatus } from "~/generated/prisma/enums"
import { ErrorWithStatus } from "~/models/Errors"
import { AdminReviewQuery, CreateFeedbackDto } from "~/models/schemas/review.schema"

class ReviewServices {
  async createFeedback({ customerId, dto }: { customerId: string, dto: CreateFeedbackDto }) {
    const order = await prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true }
    })

    if (!order || order.customerId !== customerId) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Đơn hàng này không phải của bạn'
      })
    }

    if (order.status !== OrderStatus.SERVED && order.status !== OrderStatus.COMPLETED) {
      throw new ErrorWithStatus({
        httpStatusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Chỉ có thể đánh giá món sau khi đơn đã được phục vụ'
      })
    }

    const hasItem = order.items.some(i => i.menuItemId === dto.menuItemId)
    if (!hasItem) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.BAD_REQUEST, message: 'Món này không có trong đơn' })
    }

    return prisma.review.create({
      data: {
        customerId,
        orderId: dto.orderId,
        menuItemId: dto.menuItemId,
        comment: dto.comment,
        rating: dto.rating,
        images: dto.images || []
      }

    }).catch((e: any) => {
      if (e.code === 'P2002') throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.BAD_REQUEST, message: 'Bạn đã đánh giá món này rồi' })
      throw e
    })
  }

  async listByMenuItem(menuItemId: string, page = 1, limit = 10) {
    const [data, total] = await Promise.all([
      prisma.review.findMany({
        where: { menuItemId },
        include: { customer: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.review.count({ where: { menuItemId } })
    ])
    return { data, total, avg: await this.getAvg(menuItemId) }
  }

  async getAvg(menuItemId: string) {
    const agg = await prisma.review.aggregate({ where: { menuItemId }, _avg: { rating: true }, _count: true })
    return { avgRating: agg._avg.rating || 0, count: agg._count }
  }

  async listAll(query: AdminReviewQuery) {
    const { page = 1, limit = 20, menuItemId, rating, search } = query
    const where = {
      ...(menuItemId && { menuItemId }),
      ...(rating && { rating }),
      ...(search && {
        OR: [
          { comment: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
          { menuItem: { name: { contains: search, mode: 'insensitive' as const } } },
          { order: { orderCode: { contains: search, mode: 'insensitive' as const } } }
        ]
      })
    }
    const [data, total, stats] = await Promise.all([
      prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          comment: true,
          images: true,
          createdAt: true,
          customer: { select: { id: true, name: true, avatar: true, email: true } },
          menuItem: { select: { id: true, name: true, image: true, basePrice: true } },
          order: { select: { id: true, orderCode: true, type: true, status: true, createdAt: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({ where, _avg: { rating: true }, _count: true })
    ])
    return {
      data,
      total,
      avgRating: stats._avg.rating || 0,
      count: stats._count
    }
  }

  async delete(id: string) {
    const review = await prisma.review.findUnique({ where: { id }, select: { id: true } })
    if (!review) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đánh giá' })
    }
    await prisma.review.delete({ where: { id } })
  }
}

const reviewsServices = new ReviewServices()
export default reviewsServices

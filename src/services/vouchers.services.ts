import { prisma } from '~/config/prisma'
import HTTP_STATUS from '~/constants/httpStatus'
import { OrderStatus, OrderType, Prisma, Role, VoucherDiscountType, VoucherDistribution } from '~/generated/prisma/client'
import { ErrorWithStatus } from '~/models/Errors'
import { CreateVoucherDto, UpdateVoucherDto } from '~/models/schemas/voucher.schema'

const invalidVoucher = (message: string) => new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.BAD_REQUEST, message })
const money = (value: number) => new Prisma.Decimal(value.toFixed(2))

class VoucherServices {
  async listAdmin() {
    const vouchers = await prisma.voucher.findMany({
      include: { usages: { where: { order: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED] } } }, select: { id: true } } },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    })
    return vouchers.map(({ usages, ...voucher }) => ({ ...voucher, usedCount: usages.length }))
  }

  listAvailable(orderType?: OrderType) {
    const now = new Date()
    return prisma.voucher.findMany({
      where: {
        isActive: true,
        distribution: VoucherDistribution.ACCOUNT,
        startsAt: { lte: now },
        endsAt: { gt: now },
        ...(orderType && { applicableOrderTypes: { has: orderType } })
      },
      orderBy: [{ endsAt: 'asc' }, { createdAt: 'desc' }]
    })
  }

  async listMine(customerId: string, orderType?: OrderType) {
    const now = new Date()
    const wallets = await prisma.voucherWallet.findMany({
      where: {
        customerId,
        voucher: {
          isActive: true,
          distribution: VoucherDistribution.ACCOUNT,
          startsAt: { lte: now },
          endsAt: { gt: now },
          ...(orderType && { applicableOrderTypes: { has: orderType } })
        }
      },
      include: { voucher: true },
      orderBy: { receivedAt: 'desc' }
    })
    return wallets.map(wallet => ({ ...wallet.voucher, receivedAt: wallet.receivedAt }))
  }

  async create(dto: CreateVoucherDto) {
    const voucher = await prisma.voucher.create({ data: this.toData(dto) as Prisma.VoucherCreateInput })
    await this.syncWallets(voucher.id, voucher.distribution)
    return voucher
  }

  async update(id: string, dto: UpdateVoucherDto) {
    await this.ensureExists(id)
    const voucher = await prisma.voucher.update({ where: { id }, data: this.toData(dto) })
    if (dto.distribution !== undefined) await this.syncWallets(voucher.id, voucher.distribution)
    return voucher
  }

  async delete(id: string) {
    await this.ensureExists(id)
    const used = await prisma.voucherUsage.count({ where: { voucherId: id } })
    if (used > 0) throw invalidVoucher('Voucher đã được sử dụng. Hãy tắt voucher thay vì xóa để giữ lịch sử đơn hàng.')
    await prisma.voucher.delete({ where: { id } })
  }

  async calculate(code: string, subtotal: number, orderType: OrderType, customerId?: string) {
    const normalizedCode = code.trim().toUpperCase()
    const voucher = await prisma.voucher.findUnique({ where: { code: normalizedCode } })
    if (!voucher || !voucher.isActive) throw invalidVoucher('Mã voucher không tồn tại hoặc đã bị tắt')
    const now = new Date()
    if (voucher.startsAt > now) throw invalidVoucher('Voucher chưa đến thời gian sử dụng')
    if (voucher.endsAt <= now) throw invalidVoucher('Voucher đã hết hạn')
    if (!voucher.applicableOrderTypes.includes(orderType)) throw invalidVoucher('Voucher không áp dụng cho loại đơn này')
    const validUsageWhere = {
      voucherId: voucher.id,
      order: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED] } }
    }
    const activeUses = await prisma.voucherUsage.count({ where: validUsageWhere })
    if (voucher.usageLimit !== null && activeUses >= voucher.usageLimit) throw invalidVoucher('Voucher đã hết lượt sử dụng')
    if (subtotal < Number(voucher.minOrderAmount)) {
      throw invalidVoucher(`Đơn hàng tối thiểu ${Number(voucher.minOrderAmount).toLocaleString('vi-VN')}đ để dùng voucher này`)
    }
    if (customerId) {
      const customerUses = await prisma.voucherUsage.count({ where: { ...validUsageWhere, customerId } })
      if (customerUses >= voucher.perCustomerLimit) throw invalidVoucher('Bạn đã dùng hết lượt của voucher này')
    }
    if (voucher.distribution === VoucherDistribution.ACCOUNT) {
      if (!customerId) throw invalidVoucher('Vui lòng đăng nhập để sử dụng voucher trong tài khoản')
      const assigned = await prisma.voucherWallet.findUnique({
        where: { voucherId_customerId: { voucherId: voucher.id, customerId } }, select: { id: true }
      })
      if (!assigned) throw invalidVoucher('Voucher này chưa được cấp cho tài khoản của bạn')
    }
    let discountAmount = voucher.discountType === VoucherDiscountType.PERCENT
      ? subtotal * Number(voucher.discountValue) / 100
      : Number(voucher.discountValue)
    if (voucher.maxDiscountAmount !== null) discountAmount = Math.min(discountAmount, Number(voucher.maxDiscountAmount))
    discountAmount = Math.min(subtotal, Math.max(0, Math.round(discountAmount)))
    return { voucher, discountAmount }
  }

  private async ensureExists(id: string) {
    if (!await prisma.voucher.findUnique({ where: { id }, select: { id: true } })) {
      throw new ErrorWithStatus({ httpStatusCode: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy voucher' })
    }
  }

  private toData(dto: UpdateVoucherDto) {
    return {
      ...dto,
      ...(dto.code !== undefined && { code: dto.code.toUpperCase() }),
      ...(dto.discountValue !== undefined && { discountValue: money(dto.discountValue) }),
      ...(dto.minOrderAmount !== undefined && { minOrderAmount: money(dto.minOrderAmount) }),
      ...(dto.maxDiscountAmount !== undefined && { maxDiscountAmount: dto.maxDiscountAmount === null ? null : money(dto.maxDiscountAmount) })
    }
  }

  private async syncWallets(voucherId: string, distribution: VoucherDistribution) {
    if (distribution === VoucherDistribution.SECRET) {
      await prisma.voucherWallet.deleteMany({ where: { voucherId } })
      return
    }
    const customers = await prisma.user.findMany({ where: { role: Role.CUSTOMER, isActive: true }, select: { id: true } })
    if (customers.length) {
      await prisma.voucherWallet.createMany({
        data: customers.map(customer => ({ voucherId, customerId: customer.id })),
        skipDuplicates: true
      })
    }
  }
}

export default new VoucherServices()

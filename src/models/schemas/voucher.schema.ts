import z from 'zod'
import { OrderType, VoucherDiscountType, VoucherDistribution } from '~/generated/prisma/enums'

const voucherFields = z.object({
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ gồm chữ, số, _ hoặc -').transform(v => v.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  discountType: z.enum(VoucherDiscountType),
  distribution: z.enum(VoucherDistribution).default(VoucherDistribution.SECRET),
  discountValue: z.number().positive('Giá trị giảm phải lớn hơn 0'),
  minOrderAmount: z.number().min(0).default(0),
  maxDiscountAmount: z.number().positive().nullable().optional(),
  applicableOrderTypes: z.array(z.enum(OrderType)).min(1).default(Object.values(OrderType)),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perCustomerLimit: z.number().int().positive().default(1),
  isActive: z.boolean().default(true)
})

const voucherBody = voucherFields.superRefine((value, ctx) => {
  if (value.endsAt <= value.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Thời gian kết thúc phải sau thời gian bắt đầu' })
  if (value.discountType === VoucherDiscountType.PERCENT && value.discountValue > 100) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Mức giảm phần trăm không vượt quá 100%' })
  }
})

export const createVoucherSchema = z.object({ body: voucherBody })
export const updateVoucherSchema = z.object({
  body: voucherFields.partial()
    .refine(v => Object.keys(v).length > 0, 'Cần ít nhất một trường cập nhật')
    .superRefine((value, ctx) => {
      if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
        ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Thời gian kết thúc phải sau thời gian bắt đầu' })
      }
      if (value.discountType === VoucherDiscountType.PERCENT && value.discountValue !== undefined && value.discountValue > 100) {
        ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Mức giảm phần trăm không vượt quá 100%' })
      }
    })
})
export const applyVoucherSchema = z.object({ body: z.object({ code: z.string().trim().min(1).max(200) }) })
export type CreateVoucherDto = z.infer<typeof voucherBody>
export type UpdateVoucherDto = Partial<CreateVoucherDto>

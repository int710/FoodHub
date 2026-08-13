import z from 'zod'
import { ItemStatus, OrderStatus, OrderType } from '~/generated/prisma/enums'

const CartItemSharedSchema = z.object({
  id: z.string().optional(),
  menuItemId: z.cuid({ error: 'Mã item không được để trống' }),
  quantity: z.coerce
    .number({ error: 'quantity phải là số' })
    .int('quantity phải là số nguyên')
    .positive('quantity phải > 0')
    .max(99, 'tối đa 99 món'),
  note: z.string().max(255, 'Ghi chú không được quá 255 ký tự').optional().default(''),
  variantOptionIds: z
    .array(z.string({ error: 'variant ID phải là string' }).min(1, 'variant ID không được rỗng'))
    .optional()
    .default([]),
  addedBy: z.string({ error: 'addedBy là bắt buộc' }).optional(),
  addedAt: z
    .number()
    .int()
    .positive()
    .default(() => Date.now())
    .optional()
})

export const cartItemsSchema = z.object({
  body: CartItemSharedSchema
})

export type CartItem = z.infer<typeof cartItemsSchema>['body']

export const UpdateQtySchema = z.object({ body: z.object({ quantity: z.coerce.number().int().positive().max(99) }) })
export const UpdateDetailSchema = z
  .object({
    body: z.object({
      quantity: z.coerce.number().int().positive().max(99).optional(),
      note: z.string().max(255).optional(),
      variantOptionIds: z.array(z.string().min(1)).optional()
    })
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Phải có ít nhất 1 field' })

export type UpdateDetailItemType = z.infer<typeof UpdateDetailSchema>['body']


export const orderHistoryQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(OrderStatus).optional(),
    type: z.enum(OrderType).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    tableId: z.string().optional(),
    customerId: z.uuid().optional()
  })
})
export type HistoryQuery = z.infer<typeof orderHistoryQuerySchema>['query']

export const kitchenOrdersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum([ItemStatus.WAITING, ItemStatus.PREPARING]).optional()
  })
})
export type KitchenQuery = z.infer<typeof kitchenOrdersQuerySchema>['query']

//
const orderIdParamsSchema = z.object({
  id: z.cuid('Order ID không hợp lệ')
})

const orderItemIdParamsSchema = z.object({
  itemId: z.cuid('Order item ID không hợp lệ')
})

export const confirmOrderSchema = z.object({
  params: orderIdParamsSchema,
  body: z.object({}).strict()
})

export const rejectOrderSchema = z.object({
  params: orderIdParamsSchema,
  body: z.object({
    reason: z.string().trim().min(1, 'Lý do từ chối là bắt buộc').max(255)
  })
})

export const cancelOrderSchema = z.object({
  params: orderIdParamsSchema,
  body: z.object({
    reason: z.string().trim().min(1, 'Lý do huỷ là bắt buộc').max(255)
  })
})

export const serveOrderSchema = z.object({
  params: orderIdParamsSchema,
  body: z.object({}).strict()
})

export const updateKitchenItemStatusSchema = z.object({
  params: orderItemIdParamsSchema,
  body: z.object({
    status: z.enum([ItemStatus.PREPARING, ItemStatus.READY])
  })
})
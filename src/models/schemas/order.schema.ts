import z from 'zod'

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
// export type

import z, { number } from 'zod'

export const createTableShema = z.object({
  body: z.object({
    name: z.string().min(1, 'Tên bàn không được để trống'),
    capacity: z.number().int().min(1, 'Chỗ ngồi phải ít nhất 1 người').default(2),
    floor: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
    isActive: z.boolean().default(true)
  })
})
export type TableReqBody = z.infer<typeof createTableShema>['body']

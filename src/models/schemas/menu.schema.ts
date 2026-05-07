import z from 'zod'

export const menuRequestBody = z.object({
  body: z.object({
    name: z.string().min(1, 'Tên danh mục không được để trống'),
    icon: z.string().min(1, 'Icon hiển thị đại diện cho danh mục chính'),
    sortOrder: z.number().int().optional().default(0)
  })
})

export type CategoryBody = z.infer<typeof menuRequestBody>['body']

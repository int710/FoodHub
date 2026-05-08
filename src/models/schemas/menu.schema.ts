import z from 'zod'

export const menuRequestBody = z.object({
  body: z.object({
    name: z.string().min(1, 'Tên danh mục không được để trống'),
    icon: z.string().min(1, 'Icon hiển thị đại diện cho danh mục chính'),
    sortOrder: z.number().int().optional().default(0)
  })
})

export type CategoryBody = z.infer<typeof menuRequestBody>['body']

const menuItemSchema = z.object({
  id: z.cuid().optional(),
  categoryId: z.cuid({ message: 'Danh mục không hợp lệ' }),
  name: z.string().min(2, 'Tên món ăn phải có ít nhất 2 ký tự').max(100, 'Tên món quá dài'),
  description: z.string().max(500, 'Mô tả không quá 500 ký tự').nullable().optional(),
  basePrice: z.coerce.number({ message: 'Giá bán không hợp lệ' }).positive('Giá phải lớn hơn 0'),
  image: z.url('URL ảnh không hợp lệ').optional().nullable(),
  isAvailable: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(true),
  totalOrder: z.number().int().nonnegative().default(0),
  avgRating: z.coerce.number().min(0).max(5).default(0),
  sortOrder: z.number().int().default(0)
})

export const createMenuItemBody = z.object({
  body: menuItemSchema.omit({
    id: true,
    totalOrder: true,
    avgRating: true
  })
})
export type CreateMenuItemRequest = z.infer<typeof createMenuItemBody>['body']

export const updateMenuItemSchema = z.object({
  params: z.object({ id: z.cuid({ message: 'Id menu item cần sửa không hợp lệ' }) }),
  body: menuItemSchema.omit({ id: true }).partial()
})
export type UpdateMenuItemRequestBody = z.infer<typeof updateMenuItemSchema>['body']

export const getItemsQuery = z.object({
  query: z.object({
    categoryId: z.cuid({ message: 'Định dạng danh mục không hợp lệ' }).optional().or(z.literal('')),
    isAvailable: z.preprocess((val) => {
      if (val === 'true') return true
      if (val === 'false') return false
      return val
    }, z.boolean().optional()),
    page: z.coerce.number().int().positive('Trang phải là số nguyên dương').default(1),
    limit: z.coerce
      .number()
      .int()
      .positive('Số lượng sản phẩm muốn lấy phải lớn hơn 0')
      .max(100, 'Không thể lấy nhiều hơn 100 sản phẩm cùng một lúc')
      .default(20)
  })
})
export type GetAllItemsQueryType = z.infer<typeof getItemsQuery>['query']

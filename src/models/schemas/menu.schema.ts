import z from 'zod'
import { VariantType } from '~/generated/prisma/enums'

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

const variantOptions = z.object({
  id: z.cuid({ message: 'Id không hợp lệ' }).optional(),
  name: z.string().min(1, 'Tên phần tùy chọn không được để trống'),
  priceAdd: z.number().min(0, 'Giá cộng thêm không được âm').default(0),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().default(true).optional()
})

export const variantGroupItemSchema = z.object({
  params: z.object({ idItem: z.cuid({ message: 'Id item không hợp lệ' }) }),
  body: z.object({
    name: z.string().min(1, 'Tên nhóm biến thể không được để trống'),
    type: z.enum(VariantType).default(VariantType.SINGLE),
    isRequired: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    options: z.array(variantOptions).min(1, 'Phải có ít nhất một tùy chọn')
  })
})
export type VariantGroupRequestType = z.infer<typeof variantGroupItemSchema>['body']

export const updateVariantGroupItem = z.object({
  params: z.object({ groupVariantId: z.cuid({ message: 'Id group variant item không hợp lệ' }) }),
  body: variantGroupItemSchema.shape.body.partial()
})
export type UpdateVariantGroupInput = z.infer<typeof updateVariantGroupItem>['body']

export const createFlashSaleSchema = z.object({
  body: z
    .object({
      itemId: z.cuid({ message: 'Id sản phẩm không hợp lệ' }).min(1),
      discountPercent: z.number().min(0.01, 'Giảm giá ít nhất 0.01%').max(100, 'Giảm giá không được phép quá 100%'),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
      isActive: z.boolean().optional().default(true),
      createdById: z.string().min(1, 'Không được bỏ trống ID người tạo flash-sales').optional()
    })
    .refine((date) => new Date(date.endsAt) > new Date(date.startsAt), {
      error: 'Thời gian kết thúc phải sau khi thời gian bắt đầu',
      path: ['endsAt']
    })
})

export type CreateFlashSalesType = z.infer<typeof createFlashSaleSchema>['body']

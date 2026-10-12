import z from 'zod'

const optionalText = z.string().trim().max(255).nullable().optional()

export const updateSystemSettingSchema = z.object({
  body: z.object({
    appName: z.string().trim().min(1, 'Tên ứng dụng không được để trống').max(80).optional(),
    restaurantName: z.string().trim().min(1, 'Tên nhà hàng không được để trống').max(120).optional(),
    supportEmail: z.email('Email hỗ trợ không hợp lệ').nullable().optional(),
    supportPhone: optionalText,
    address: z.string().trim().max(500).nullable().optional(),
    logoUrl: z.url('Logo phải là URL hợp lệ').nullable().optional(),
    vatRate: z.number().min(0, 'VAT không được âm').max(100, 'VAT không được vượt quá 100%').optional(),
    serviceFeeRate: z.number().min(0).max(100).optional(),
    defaultDeliveryFee: z.number().min(0).max(100000000).optional(),
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional()
  }).refine((body) => Object.keys(body).length > 0, 'Cần ít nhất một thông tin để cập nhật')
})

export type UpdateSystemSettingDto = z.infer<typeof updateSystemSettingSchema>['body']

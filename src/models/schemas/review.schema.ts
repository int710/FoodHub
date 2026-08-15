import z from "zod";

export const createFeedbackSchema = z.object({
  body: z.object({
    orderId: z.cuid('orderId không hợp lệ'),
    menuItemId: z.cuid('menuItemId không hợp lệ'),
    rating: z.number().int().min(1, 'Tối thiểu 1 sao').max(5, 'Tối đa 5 sao'),
    comment: z.string().trim().max(1000, 'Comment tối đa 1000 ký tự').optional().or(z.literal('')),
    images: z.array(z.url('Ảnh phải là URL')).max(5, 'Tối đa 5 ảnh').optional().default([])
  })
})

export type CreateFeedbackDto = z.infer<typeof createFeedbackSchema>['body']
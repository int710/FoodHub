import z from 'zod'

export const notificationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    unreadOnly: z.enum(['true', 'false']).transform((value) => value === 'true').default(false)
  })
})

export const notificationIdParamsSchema = z.object({
  id: z.string().min(1, 'Notification ID không hợp lệ')
})

export type NotificationQuery = z.infer<typeof notificationQuerySchema>['query']
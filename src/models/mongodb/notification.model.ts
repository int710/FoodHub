import { InferSchemaType, Schema, model } from 'mongoose'

export enum NotificationType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_PAYMENT_SUCCESS = 'ORDER_PAYMENT_SUCCESS',
  ORDER_PAYMENT_FAILED = 'ORDER_PAYMENT_FAILED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_REJECTED = 'ORDER_REJECTED',
  ORDER_PREPARING = 'ORDER_PREPARING',
  ORDER_READY = 'ORDER_READY',
  ORDER_SERVED = 'ORDER_SERVED',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_PAYMENT_RECEIVED = 'ORDER_PAYMENT_RECEIVED'
}

export enum NotificationRecipientRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER'
}

const notificationSchema = new Schema(
  {
    recipientId: { type: String, required: true, index: true },
    recipientRole: {
      type: String,
      enum: Object.values(NotificationRecipientRole),
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true
    },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    orderId: { type: String, default: null, index: true },
    orderCode: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null, index: true },
    dedupeKey: { type: String, required: true },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    }
  },
  { timestamps: true }
)

notificationSchema.index({ recipientId: 1, createdAt: -1 })
notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 })
notificationSchema.index({ recipientId: 1, dedupeKey: 1 }, { unique: true })
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type INotification = InferSchemaType<typeof notificationSchema>
export const NotificationModel = model<INotification>('Notification', notificationSchema)
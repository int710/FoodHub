import { Schema, model, InferSchemaType } from 'mongoose'

export enum ConversationStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

const conversationSchema = new Schema(
  {
    // Lưu ID dạng String để tương thích hoàn toàn với Prisma ID (UUID, CUID, Int...)
    customerId: {
      type: String,
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: Object.values(ConversationStatus),
      default: ConversationStatus.OPEN,
      index: true
    },

    assignedHostId: {
      type: String,
      default: null,
      index: true
    },

    assignedAt: {
      type: Date,
      default: null
    },

    lastMessage: {
      type: String,
      default: null
    },

    lastMessageSenderId: {
      type: String,
      default: null
    },

    lastMessageAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
)

// Compound Index: Tối ưu cho truy vấn hiển thị danh sách chat mới nhất theo Khách hàng / Host
conversationSchema.index({ customerId: 1, lastMessageAt: -1 })
conversationSchema.index({ assignedHostId: 1, status: 1, lastMessageAt: -1 })

conversationSchema.index(
  { customerId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: ConversationStatus.OPEN }
  }
)

// Export Type chuẩn cho TypeScript
export type IConversation = InferSchemaType<typeof conversationSchema>
export const ConversationModel = model<IConversation>('Conversation', conversationSchema)
import { Schema, model, InferSchemaType } from 'mongoose'

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE'
}

export enum SenderRole {
  CUSTOMER = 'customer',
  STAFF = 'staff',
  ADMIN = 'admin'
}

const messageSchema = new Schema(
  {
    // Giữ Types.ObjectId vì reference đến ConversationModel ngay trong MongoDB
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true
    },

    // Dùng String vì senderId trỏ đến User/Customer/Staff nằm bên Prisma DB
    senderId: {
      type: String,
      required: true
    },

    senderRole: {
      type: String,
      enum: Object.values(SenderRole),
      required: true
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },

    type: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.TEXT
    }
  },
  {
    timestamps: true
  }
)

messageSchema.index({ conversationId: 1, createdAt: -1 })

export type IMessage = InferSchemaType<typeof messageSchema>
export const MessageModel = model<IMessage>('Message', messageSchema)
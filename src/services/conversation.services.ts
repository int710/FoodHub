import { ConversationModel, ConversationStatus, IConversation } from "~/models/mongodb/conversation.model"
import { MessageModel } from "~/models/mongodb/message.model"

export class ConversationServices {
  static async getOrCreateForCustomer(customerId: string): Promise<{ conversation: IConversation, isNew: boolean }> {
    let conversation = await ConversationModel.findOne({
      customerId,
      status: ConversationStatus.OPEN
    })
    if (conversation) {
      return { conversation, isNew: false }
    }

    conversation = await ConversationModel.create({
      customerId,
      status: ConversationStatus.OPEN,
      assignedHostId: null,
      assignedAt: null,
      lastMessage: null,
      lastMessageSenderId: null,
      lastMessageAt: null
    })

    return { conversation, isNew: true }
  }

  static async updatedLastMessage(conversationId: string, content: string, senderId: string): Promise<IConversation | null> {
    return await ConversationModel.findByIdAndUpdate(conversationId,
      {
        lastMessage: content,
        lastMessageSenderId: senderId,
        lastMessageAt: new Date()
      }, {
      new: true
    })
  }

  static async assignedHostIfUnassigned(conversationId: string, hostId: string): Promise<{ conversation: IConversation | null; isAssigned: boolean }> {
    const conversation = await ConversationModel.findById(conversationId)
    if (!conversation) return { conversation: null, isAssigned: false }
    if (!conversation.assignedHostId) {
      conversation.assignedHostId = hostId
      conversation.assignedAt = new Date()
      await conversation.save()
      return { conversation, isAssigned: true }
    }
    return { conversation, isAssigned: false }
  }

  static async getMessageHistory({ conversationId, page = 1, limit = 20 }: {
    conversationId: string;
    page?: number | undefined;
    limit?: number | undefined
  }) {
    const skip = (page - 1) * limit;
    const messages = await MessageModel.find({ conversationId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    const total = await MessageModel.countDocuments({ conversationId });
    const hasMore = skip + messages.length < total;

    return {
      conversationId,
      messages: messages.reverse(),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        hasMore
      }
    }
  }
}

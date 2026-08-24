export const HOST_ROOM = `host:room`
export const getConversationRoom = (conversationId: string): string => {
  return `conversation:${conversationId}`
}
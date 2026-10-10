import { getSocketIO } from './socket.instance'

export const emitMenuUpdated = (payload: { itemId?: string; action: string }) => {
  try {
    getSocketIO().emit('menu:updated', { ...payload, updatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('[Socket Emitter Error] Failed to emit menu update:', error)
  }
}

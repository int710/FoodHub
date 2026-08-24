class PresenceManager {
  private onlineUsers: Map<string, Set<string>> = new Map()

  public addSocket(userId: string, socketId: string): boolean {
    let userSockets = this.onlineUsers.get(userId)
    const firstConnection = !userSockets || userSockets.size === 0
    if (!userSockets) {
      userSockets = new Set()
      this.onlineUsers.set(userId, userSockets)
    }
    userSockets.add(socketId)
    return firstConnection
  }

  public removeSocket(userId: string, socketId: string): boolean {
    const userSockets = this.onlineUsers.get(userId)
    if (!userSockets) return false
    userSockets.delete(socketId)
    if (userSockets.size === 0) {
      this.onlineUsers.delete(userId)
      return true
    }
    return false
  }

  public isUserOnline(userId: string): boolean {
    const userSockets = this.onlineUsers.get(userId)
    return !!userSockets && userSockets.size > 0
  }
  public getOnlineUsers(): string[] {
    return Array.from(this.onlineUsers.keys())
  }
}

export const presenceManager = new PresenceManager()
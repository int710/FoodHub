export const TTL_8H = 8 * 60 * 60

export const RedisKey = {
  tableSession: (sessionId: string) => `table:session:${sessionId}`,
  tableSessions: (tid: string) => `table:sessions:${tid}`,
  tableHost: (tid: string) => `table:host:${tid}`,
  cartTable: (tid: string) => `table:cart:${tid}`
}

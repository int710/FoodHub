export const RedisKey = {
  tableSession: (sessionId: string) => `table:sessions:${sessionId}`
}

import { connectMongodb } from './mongodb'
import { connectPostgres } from './prisma'
import { redis } from './redis'

export const initConnectSystem = async () => {
  return Promise.all([connectMongodb(), connectPostgres(), redis.connect()])
}

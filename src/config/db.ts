import { connectMongodb } from './mongodb'
import { connectPostgres } from './prisma'

export const connectDB = async () => {
  return Promise.all([connectMongodb(), connectPostgres()])
}

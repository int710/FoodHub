import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '~/generated/prisma/client'

declare global {
  var __prisma: PrismaClient | undefined
}

const connectionString = `${process.env.DATABASE_URL_POSTGRESQL}`

const adapter = new PrismaPg({ connectionString })

const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
  })
}

export const connectPostgres = async () => {
  try {
    await prisma.$connect()
    console.log('Connected postgreSQL successfully !')
  } catch (err) {
    console.log('You connected postgreSQL failed', err)
    throw err
  }
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient()

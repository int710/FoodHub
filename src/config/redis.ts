import Redis, { Redis as RedisType } from 'ioredis'

class RedisClient {
  private static instance: RedisClient
  private client!: RedisType
  private isReady = false

  private constructor() { }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient()
    }
    return RedisClient.instance
  }

  async connect(): Promise<void> {
    if (this.isReady) return

    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      retryStrategy: (times: number) => {
        if (times > 10) return null
        const delay = Math.min(times * 200, 3000)
        return delay
      },
      maxRetriesPerRequest: 5,
      enableReadyCheck: true,
      lazyConnect: false
    })

    // Theo dõi status redis và ghi log
    this.client.on('connect', () => console.log('Connected redis successfully !'))
    this.client.on('ready', () => {
      this.isReady = true
      console.log('Redis is ready')
    })
    this.client.on('error', (err) => {
      console.log('Redis error')
      this.isReady = false
    })
    this.client.on('reconnecting', () => console.log('Redis is reconnecting...'))
    this.client.on('end', () => {
      this.isReady = false
      console.log('Redis connection closed')
    })
  }

  async get<T = any>(key: string): Promise<T | null> {
    const data = await this.client.get(key)
    if (!data) return null
    try {
      return JSON.parse(data) as T
    } catch {
      return data as T
    }
  }
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)

    if (ttl) {
      await this.client.set(key, serialized, 'EX', ttl)
    } else {
      await this.client.set(key, serialized)
    }
  }

  async setNX(key: string, val: any, ttl: number): Promise<boolean> {
    const serialized = typeof val === 'string' ? val : JSON.stringify(val)
    return (await this.client.set(key, serialized, 'EX', ttl, 'NX')) === 'OK'
  }

  async sadd(key: string, ...members: (string | number)[]): Promise<number> {
    return this.client.sadd(key, ...members)
  }

  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys)
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(key)
    return count > 0
  }

  async hset(key: string, field: string, value: any): Promise<number> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    return this.client.hset(key, field, serialized)
  }
  async hget<T = any>(key: string, field: string): Promise<T | null> {
    const data = await this.client.hget(key, field)
    if (!data) return null
    try {
      return JSON.parse(data) as T
    } catch {
      return data as T
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key)
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(key, ...fields)
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key)
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    return this.client.expire(key, ttlSeconds)
  }

  async pexpire(key: string, ttlMs: number): Promise<number> {
    return this.client.pexpire(key, ttlMs)
  }

  get isConnected(): boolean {
    return this.isReady
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.isReady = false
    }
  }
}

export const redis = RedisClient.getInstance()

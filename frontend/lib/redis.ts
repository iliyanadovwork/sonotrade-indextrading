import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL

let redis: Redis | null = null

export function getRedis(): Redis | null {
  if (!REDIS_URL) return null
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    })
    redis.on('error', (err) => {
      console.error('[redis] connection error:', err.message)
    })
  }
  return redis
}

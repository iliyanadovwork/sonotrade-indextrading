import { getRedis } from './redis'

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

/**
 * Fail mode when Redis is absent or erroring.
 *
 * 'open'   — allow the request. Only acceptable for cosmetic/read limits where
 *            being unavailable is worse than being unlimited.
 * 'closed' — deny the request. Required for anything that moves money, mints
 *            accounts, sends email, or spends money upstream: an unavailable
 *            limiter must not silently become an unlimited one.
 */
export type FailMode = 'open' | 'closed'

/**
 * Sliding-window rate limiter using Redis INCR + EXPIRE.
 * @param key    unique key e.g. `otp:user@example.com`
 * @param limit  max requests allowed in the window
 * @param windowSeconds  window duration in seconds
 * @param failMode  what to do when Redis is unreachable (default: 'closed')
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  failMode: FailMode = 'closed',
): Promise<RateLimitResult> {
  const redis = getRedis()

  if (!redis) {
    // Development has no Redis and requiring one would make the app unusable
    // locally. Production must never silently drop its limits, so the
    // fail-closed behaviour is scoped to real deployments.
    if (failMode === 'closed' && process.env.NODE_ENV === 'production') {
      console.error(`[rateLimit] REDIS_URL unset — denying "${key}" (fail-closed)`)
      return { allowed: false, remaining: 0, resetInSeconds: windowSeconds }
    }
    if (failMode === 'closed') {
      console.warn(`[rateLimit] no Redis in development — allowing "${key}" unthrottled`)
    }
    return { allowed: true, remaining: limit, resetInSeconds: windowSeconds }
  }

  try {
    const redisKey = `rl:${key}`
    // Single round trip instead of INCR + EXPIRE + TTL: this sits on the
    // critical path of login and order placement.
    const [count, ttl] = (await redis
      .multi()
      .incr(redisKey)
      .expire(redisKey, windowSeconds, 'NX')
      .ttl(redisKey)
      .exec()
      .then(res => [Number(res?.[0]?.[1] ?? 0), Number(res?.[2]?.[1] ?? windowSeconds)])) as [number, number]

    const remaining = Math.max(0, limit - count)
    return { allowed: count <= limit, remaining, resetInSeconds: ttl }
  } catch (err) {
    console.error(`[rateLimit] redis error on "${key}":`, err instanceof Error ? err.message : err)
    if (failMode === 'closed') {
      return { allowed: false, remaining: 0, resetInSeconds: windowSeconds }
    }
    return { allowed: true, remaining: limit, resetInSeconds: windowSeconds }
  }
}

/**
 * Acquire a short-lived distributed lock.
 * Returns true if the lock was acquired, false if already held.
 *
 * Fails CLOSED (returns false) when Redis is unavailable: callers use this to
 * serialise money-moving work, and a lock that silently always succeeds is
 * indistinguishable from having no lock at all.
 *
 * This is defence in depth only — correctness for trades comes from the
 * per-row locking inside place_order_tx / close_position_tx in Postgres.
 */
export async function acquireLock(key: string, ttlSeconds = 10): Promise<boolean> {
  const redis = getRedis()
  if (!redis) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[acquireLock] REDIS_URL unset — refusing lock "${key}" (fail-closed)`)
      return false
    }
    console.warn(`[acquireLock] no Redis in development — granting "${key}" unguarded`)
    return true
  }
  try {
    const result = await redis.set(`lock:${key}`, '1', 'EX', ttlSeconds, 'NX')
    return result === 'OK'
  } catch (err) {
    console.error(`[acquireLock] redis error on "${key}":`, err instanceof Error ? err.message : err)
    return false
  }
}

export async function releaseLock(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(`lock:${key}`)
  } catch {
    // non-fatal
  }
}

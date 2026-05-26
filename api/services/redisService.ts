import Redis from 'ioredis'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379'
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000)
        return delay
      },
      lazyConnect: true,
    })
    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })
    redis.on('connect', () => {
      console.log('[Redis] Connected successfully')
    })
  }
  return redis
}

export async function redisGet<T = string>(key: string): Promise<T | null> {
  try {
    const client = getRedis()
    const value = await client.get(key)
    if (value === null) return null
    try {
      return JSON.parse(value) as T
    } catch {
      return value as unknown as T
    }
  } catch (error) {
    console.error('[Redis] GET error:', (error as Error).message)
    return null
  }
}

export async function redisSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  try {
    const client = getRedis()
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, serialized)
    } else {
      await client.set(key, serialized)
    }
  } catch (error) {
    console.error('[Redis] SET error:', (error as Error).message)
  }
}

export async function redisDel(key: string): Promise<void> {
  try {
    const client = getRedis()
    await client.del(key)
  } catch (error) {
    console.error('[Redis] DEL error:', (error as Error).message)
  }
}

export async function redisExists(key: string): Promise<boolean> {
  try {
    const client = getRedis()
    const result = await client.exists(key)
    return result === 1
  } catch (error) {
    console.error('[Redis] EXISTS error:', (error as Error).message)
    return false
  }
}

export async function redisKeys(pattern: string): Promise<string[]> {
  try {
    const client = getRedis()
    return await client.keys(pattern)
  } catch (error) {
    console.error('[Redis] KEYS error:', (error as Error).message)
    return []
  }
}

export async function redisIncr(key: string): Promise<number> {
  try {
    const client = getRedis()
    return await client.incr(key)
  } catch (error) {
    console.error('[Redis] INCR error:', (error as Error).message)
    return 0
  }
}

export async function redisExpire(key: string, ttlSeconds: number): Promise<void> {
  try {
    const client = getRedis()
    await client.expire(key, ttlSeconds)
  } catch (error) {
    console.error('[Redis] EXPIRE error:', (error as Error).message)
  }
}

export async function redisHset(key: string, field: string, value: unknown): Promise<void> {
  try {
    const client = getRedis()
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    await client.hset(key, field, serialized)
  } catch (error) {
    console.error('[Redis] HSET error:', (error as Error).message)
  }
}

export async function redisHget<T = string>(key: string, field: string): Promise<T | null> {
  try {
    const client = getRedis()
    const value = await client.hget(key, field)
    if (value === null) return null
    try {
      return JSON.parse(value) as T
    } catch {
      return value as unknown as T
    }
  } catch (error) {
    console.error('[Redis] HGET error:', (error as Error).message)
    return null
  }
}

export async function redisHgetall<T = Record<string, unknown>>(key: string): Promise<T | null> {
  try {
    const client = getRedis()
    const data = await client.hgetall(key)
    if (!data || Object.keys(data).length === 0) return null
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data)) {
      try {
        result[k] = JSON.parse(v)
      } catch {
        result[k] = v
      }
    }
    return result as T
  } catch (error) {
    console.error('[Redis] HGETALL error:', (error as Error).message)
    return null
  }
}

export async function isRedisConnected(): Promise<boolean> {
  try {
    const client = getRedis()
    const result = await client.ping()
    return result === 'PONG'
  } catch {
    return false
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}

export const REDIS_TTL = {
  LLM_CACHE: 24 * 60 * 60,
  PROGRESS: 60 * 60,
  PROJECT_LOCK: 30 * 60,
  WORKSPACE_STATS: 5 * 60,
  PAPER_SUMMARY: 7 * 24 * 60 * 60,
  SEARCH_RESULTS: 60 * 60,
}

export const REDIS_KEYS = {
  llmCache: (hash: string) => `llm:cache:${hash}`,
  projectProgress: (projectId: string) => `project:${projectId}:progress`,
  projectLock: (projectId: string) => `project:${projectId}:lock`,
  workspaceStats: (workspaceId: string) => `workspace:${workspaceId}:stats`,
  paperSummary: (sourceId: string) => `paper:summary:${sourceId}`,
  searchResults: (queryHash: string) => `search:results:${queryHash}`,
}

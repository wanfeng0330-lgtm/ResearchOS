import Redis from 'ioredis'

const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false'

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (!REDIS_ENABLED) {
    return null
  }
  
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

// In-memory storage for disabled Redis
const memoryStore = new Map<string, { value: string; expiry?: number }>()

export async function redisGet<T = string>(key: string): Promise<T | null> {
  if (!REDIS_ENABLED) {
    const item = memoryStore.get(key)
    if (!item) return null
    if (item.expiry && Date.now() > item.expiry) {
      memoryStore.delete(key)
      return null
    }
    try {
      return JSON.parse(item.value) as T
    } catch {
      return item.value as unknown as T
    }
  }
  
  try {
    const client = getRedis()
    if (!client) return null
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
  if (!REDIS_ENABLED) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
    memoryStore.set(key, { value: serialized, expiry })
    return
  }
  
  try {
    const client = getRedis()
    if (!client) return
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
  if (!REDIS_ENABLED) {
    memoryStore.delete(key)
    return
  }
  
  try {
    const client = getRedis()
    if (!client) return
    await client.del(key)
  } catch (error) {
    console.error('[Redis] DEL error:', (error as Error).message)
  }
}

export async function redisExists(key: string): Promise<boolean> {
  if (!REDIS_ENABLED) {
    const item = memoryStore.get(key)
    if (!item) return false
    if (item.expiry && Date.now() > item.expiry) {
      memoryStore.delete(key)
      return false
    }
    return true
  }
  
  try {
    const client = getRedis()
    if (!client) return false
    const result = await client.exists(key)
    return result === 1
  } catch (error) {
    console.error('[Redis] EXISTS error:', (error as Error).message)
    return false
  }
}

export async function redisKeys(pattern: string): Promise<string[]> {
  if (!REDIS_ENABLED) {
    const keys = Array.from(memoryStore.keys())
    if (pattern === '*') return keys
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return keys.filter(key => regex.test(key))
  }
  
  try {
    const client = getRedis()
    if (!client) return []
    return await client.keys(pattern)
  } catch (error) {
    console.error('[Redis] KEYS error:', (error as Error).message)
    return []
  }
}

export async function redisIncr(key: string): Promise<number> {
  if (!REDIS_ENABLED) {
    const item = memoryStore.get(key)
    const current = item ? parseInt(item.value) || 0 : 0
    const newValue = current + 1
    memoryStore.set(key, { value: newValue.toString(), expiry: item?.expiry })
    return newValue
  }
  
  try {
    const client = getRedis()
    if (!client) return 0
    return await client.incr(key)
  } catch (error) {
    console.error('[Redis] INCR error:', (error as Error).message)
    return 0
  }
}

export async function redisExpire(key: string, ttlSeconds: number): Promise<void> {
  if (!REDIS_ENABLED) {
    const item = memoryStore.get(key)
    if (item) {
      item.expiry = Date.now() + ttlSeconds * 1000
    }
    return
  }
  
  try {
    const client = getRedis()
    if (!client) return
    await client.expire(key, ttlSeconds)
  } catch (error) {
    console.error('[Redis] EXPIRE error:', (error as Error).message)
  }
}

export async function redisHset(key: string, field: string, value: unknown): Promise<void> {
  if (!REDIS_ENABLED) {
    const item = memoryStore.get(key) || { value: '{}' }
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(item.value)
    } catch {
      obj = {}
    }
    obj[field] = typeof value === 'string' ? value : JSON.stringify(value)
    memoryStore.set(key, { value: JSON.stringify(obj), expiry: item.expiry })
    return
  }
  
  try {
    const client = getRedis()
    if (!client) return
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    await client.hset(key, field, serialized)
  } catch (error) {
    console.error('[Redis] HSET error:', (error as Error).message)
  }
}

export async function redisHget<T = string>(key: string, field: string): Promise<T | null> {
  if (!REDIS_ENABLED) {
    const item = memoryStore.get(key)
    if (!item) return null
    try {
      const obj = JSON.parse(item.value)
      if (obj[field] === undefined) return null
      try {
        return JSON.parse(obj[field]) as T
      } catch {
        return obj[field] as unknown as T
      }
    } catch {
      return null
    }
  }
  
  try {
    const client = getRedis()
    if (!client) return null
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
  if (!REDIS_ENABLED) {
    const item = memoryStore.get(key)
    if (!item) return null
    try {
      const obj = JSON.parse(item.value)
      const result: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(obj)) {
        try {
          result[k] = JSON.parse(v as string)
        } catch {
          result[k] = v
        }
      }
      return result as T
    } catch {
      return null
    }
  }
  
  try {
    const client = getRedis()
    if (!client) return null
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
  if (!REDIS_ENABLED) {
    return true // Consider memory store as "connected"
  }
  
  try {
    const client = getRedis()
    if (!client) return false
    const result = await client.ping()
    return result === 'PONG'
  } catch {
    return false
  }
}

export async function disconnectRedis(): Promise<void> {
  if (!REDIS_ENABLED) {
    memoryStore.clear()
    return
  }
  
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

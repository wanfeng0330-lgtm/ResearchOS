import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs'
import { join } from 'path'

interface CacheEntry {
  content: string
  timestamp: number
  hitCount: number
}

const memoryCache = new Map<string, CacheEntry>()
const CACHE_TTL = 24 * 60 * 60 * 1000
const MAX_CACHE_SIZE = 2000
const FILE_CACHE_DIR = join(process.cwd(), '.cache', 'llm')
const FILE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000

function ensureCacheDir(): void {
  if (!existsSync(FILE_CACHE_DIR)) {
    mkdirSync(FILE_CACHE_DIR, { recursive: true })
  }
}

function generateCacheKey(prompt: string, systemPrompt?: string, options?: { maxTokens?: number; temperature?: number }): string {
  const data = JSON.stringify({
    p: prompt,
    s: systemPrompt || '',
    mt: options?.maxTokens || 8192,
    t: options?.temperature || 0.7,
  })
  return createHash('sha256').update(data).digest('hex')
}

export function generateStructuredCacheKey(fixedPart: string, dynamicPart: Record<string, unknown>): string {
  const combined = JSON.stringify({ f: fixedPart, d: dynamicPart })
  return createHash('sha256').update(combined).digest('hex')
}

function evictExpired(): void {
  const now = Date.now()
  for (const [key, entry] of memoryCache) {
    if (now - entry.timestamp > CACHE_TTL) {
      memoryCache.delete(key)
    }
  }
}

function evictByLRU(): void {
  if (memoryCache.size <= MAX_CACHE_SIZE) return
  const entries = Array.from(memoryCache.entries())
    .sort((a, b) => a[1].hitCount - b[1].hitCount || a[1].timestamp - b[1].timestamp)
  const toDelete = entries.slice(0, Math.floor(MAX_CACHE_SIZE * 0.3))
  for (const [key] of toDelete) {
    memoryCache.delete(key)
  }
}

function getFileCachePath(key: string): string {
  return join(FILE_CACHE_DIR, `${key}.json`)
}

function readFileCache(key: string): string | null {
  try {
    const filePath = getFileCachePath(key)
    if (!existsSync(filePath)) return null
    const data = JSON.parse(readFileSync(filePath, 'utf-8'))
    if (Date.now() - data.timestamp > FILE_CACHE_TTL) {
      try { unlinkSync(filePath) } catch {}
      return null
    }
    return data.content
  } catch {
    return null
  }
}

function writeFileCache(key: string, content: string): void {
  try {
    ensureCacheDir()
    const filePath = getFileCachePath(key)
    writeFileSync(filePath, JSON.stringify({ content, timestamp: Date.now() }))
  } catch {}
}

export function getCached(prompt: string, systemPrompt?: string, options?: { maxTokens?: number; temperature?: number }): string | null {
  const key = generateCacheKey(prompt, systemPrompt, options)
  const entry = memoryCache.get(key)
  if (entry) {
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      memoryCache.delete(key)
    } else {
      entry.hitCount++
      console.log(`[Cache] L1 HIT for key ${key.slice(0, 12)}... (hits: ${entry.hitCount})`)
      return entry.content
    }
  }

  const fileContent = readFileCache(key)
  if (fileContent !== null) {
    memoryCache.set(key, { content: fileContent, timestamp: Date.now(), hitCount: 1 })
    console.log(`[Cache] L2 FILE HIT for key ${key.slice(0, 12)}...`)
    return fileContent
  }

  return null
}

export function setCached(prompt: string, content: string, systemPrompt?: string, options?: { maxTokens?: number; temperature?: number }): void {
  const key = generateCacheKey(prompt, systemPrompt, options)
  memoryCache.set(key, { content, timestamp: Date.now(), hitCount: 0 })
  writeFileCache(key, content)
  evictExpired()
  evictByLRU()
}

export function getCacheStats(): { size: number; hitRate: number; fileCacheSize: number } {
  let totalHits = 0
  let totalEntries = 0
  for (const entry of memoryCache.values()) {
    totalHits += entry.hitCount
    totalEntries++
  }
  let fileCacheSize = 0
  try {
    ensureCacheDir()
    fileCacheSize = readdirSync(FILE_CACHE_DIR).filter(f => f.endsWith('.json')).length
  } catch {}
  return { size: totalEntries, hitRate: totalEntries > 0 ? totalHits / (totalHits + totalEntries) : 0, fileCacheSize }
}

export function clearCache(): void {
  memoryCache.clear()
  try {
    ensureCacheDir()
    for (const file of readdirSync(FILE_CACHE_DIR)) {
      if (file.endsWith('.json')) {
        try { unlinkSync(join(FILE_CACHE_DIR, file)) } catch {}
      }
    }
  } catch {}
}

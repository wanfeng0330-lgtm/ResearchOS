# Phase 2: Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Reduce paper generation time from 15-20 minutes to 5-8 minutes through LLM tiering, parallel execution, cache optimization, and prompt stabilization.

**Architecture:** Incremental optimization of existing llmService, llmCache, semaphore, orchestrator, and ragService. No rewrites — extend existing functions with new capabilities.

**Tech Stack:** TypeScript, Express 4, crypto, fs

---

## Task 1: LLM Three-Tier Architecture

**Files:**
- Modify: `api/services/llmService.ts`

**Changes:**
1. Add tier configuration constants at the top of the file (after existing constants)
2. Add `callTieredLLM` function that routes to the correct API based on tier
3. Move hardcoded VOLCENGINE_API_KEY to environment variable
4. Add TOKEN_PLAN configuration from environment variables

```typescript
type LLMTier = 'heavy' | 'medium' | 'light'

interface TierConfig {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
}

function getTierConfig(tier: LLMTier): TierConfig {
  const configs: Record<LLMTier, TierConfig> = {
    heavy: {
      baseUrl: process.env.TOKEN_PLAN_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
      apiKey: process.env.TOKEN_PLAN_API_KEY || '',
      model: 'deepseek-v4-pro',
      maxTokens: 8192,
      temperature: 0.7,
      timeout: 300000,
    },
    medium: {
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: 'deepseek-v4-pro',
      maxTokens: 4096,
      temperature: 0.5,
      timeout: 180000,
    },
    light: {
      baseUrl: process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: process.env.VOLCENGINE_API_KEY || '',
      model: process.env.VOLCENGINE_MODEL || 'deepseek-v3-2-251201',
      maxTokens: 2048,
      temperature: 0.3,
      timeout: 120000,
    },
  }
  return configs[tier]
}

export async function callTieredLLM(
  prompt: string,
  systemPrompt?: string,
  tier: LLMTier = 'medium',
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const config = getTierConfig(tier)
  if (!config.apiKey) {
    throw new Error(`${tier} tier API key is not configured`)
  }

  const messages: Array<{ role: string; content: string }> = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const maxTokens = options?.maxTokens ?? config.maxTokens
  const temperature = options?.temperature ?? config.temperature

  const cached = getCached(prompt, systemPrompt, { ...options, maxTokens, temperature })
  if (cached !== null) return cached

  const semaphore = getLLMSemaphore()
  await semaphore.acquire()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeout)

  try {
    console.log(`[TieredLLM] Calling ${tier} tier (${config.model}), prompt length: ${prompt.length}`)
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`${tier} tier API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    console.log(`[TieredLLM] ${tier} tier response received, length: ${content.length}`)
    setCached(prompt, content, systemPrompt, { ...options, maxTokens, temperature })
    return content
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${tier} tier request timed out after ${config.timeout / 1000}s`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
    semaphore.release()
  }
}
```

Also replace the hardcoded VOLCENGINE_API_KEY with:
```typescript
const VOLCENGINE_API_KEY = process.env.VOLCENGINE_API_KEY || ''
```

---

## Task 2: Increase Semaphore Concurrency

**Files:**
- Modify: `api/services/semaphore.ts`

Change `new Semaphore(2)` to `new Semaphore(6)`:
```typescript
const llmSemaphore = new Semaphore(6)
```

---

## Task 3: Cache Key Optimization + File Cache Layer

**Files:**
- Modify: `api/services/llmCache.ts`

**Changes:**
1. Increase MAX_CACHE_SIZE from 500 to 2000
2. Add structured cache key generation that separates fixed and dynamic parts
3. Add file cache layer for persistence across restarts

```typescript
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs'
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
```

---

## Task 4: WorkflowEngine Parallel Execution

**Files:**
- Modify: `api/agents/orchestrator.ts`

**Changes:**
Replace the serial `for` loop with a parallel execution engine that uses the WorkflowEngine's dependency graph.

The key change: instead of iterating `stages` array sequentially, group stages by their dependency level and execute independent stages in parallel.

Replace the `try { for (const { stage, progress, fn } of stages) {` block with:

```typescript
  workflowEngine.initWorkflowState(projectId)

  try {
    const stageMap = new Map(stages.map(s => [s.stage, s]))

    const parallelGroups: AgentStage[][] = [
      ['keyword_extracting'],
      ['searching'],
      ['parsing'],
      ['extracting'],
      ['writing'],
      ['citing'],
      ['integrity_reviewing', 'aigc_detecting', 'charting'],
      ['formatting'],
    ]

    for (const group of parallelGroups) {
      const fns = group
        .map(stageName => stageMap.get(stageName as AgentStage))
        .filter((s): s is { stage: AgentStage; progress: number; fn: () => Promise<void> } => s !== undefined)

      if (fns.length === 1) {
        const { stage, progress, fn } = fns[0]
        try {
          projectService.setProgress(projectId, { stage, progress, message: `正在处理：${stage}...` })
          workflowEngine.updateStageStatus(projectId, stage, 'running')
          await fn()
          workflowEngine.updateStageStatus(projectId, stage, 'completed')
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          console.error(`[Orchestrator] Error at stage ${stage}:`, errorMsg)
          workflowEngine.updateStageStatus(projectId, stage, 'failed', errorMsg)
          const generatedSections = projectService.getGeneratedSections(projectId)
          const hasPartialContent = generatedSections.length > 0
          projectService.setProgress(projectId, {
            stage, progress,
            message: hasPartialContent
              ? `阶段 ${stage} 失败：${errorMsg}。已完成 ${generatedSections.length} 个章节的撰写已保存，可重新生成。`
              : `阶段 ${stage} 失败：${errorMsg}`,
          })
          projectService.updateProjectStatus(projectId, 'draft')
          if (hasPartialContent) {
            console.log(`[Orchestrator] Partial content preserved: ${generatedSections.length} sections saved for project ${projectId}`)
          }
          throw error
        }
      } else {
        const results = await Promise.allSettled(
          fns.map(async ({ stage, progress, fn }) => {
            try {
              projectService.setProgress(projectId, { stage, progress, message: `正在处理：${stage}...` })
              workflowEngine.updateStageStatus(projectId, stage, 'running')
              await fn()
              workflowEngine.updateStageStatus(projectId, stage, 'completed')
              return { stage, success: true }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error'
              console.error(`[Orchestrator] Error at stage ${stage}:`, errorMsg)
              workflowEngine.updateStageStatus(projectId, stage, 'failed', errorMsg)
              return { stage, success: false, error: errorMsg }
            }
          })
        )

        const failed = results.filter((r): r is PromiseFulfilledResult<{ stage: string; success: false; error: string }> =>
          r.status === 'fulfilled' && !r.value.success
        )
        if (failed.length > 0) {
          const generatedSections = projectService.getGeneratedSections(projectId)
          const hasPartialContent = generatedSections.length > 0
          const errorMsg = failed.map(f => f.value.error).join('; ')
          projectService.setProgress(projectId, {
            stage: fns[0].stage,
            progress: fns[0].progress,
            message: `并行阶段失败：${errorMsg}`,
          })
          projectService.updateProjectStatus(projectId, 'draft')
          throw new Error(`Parallel stages failed: ${errorMsg}`)
        }
      }
    }

    if (workflowEngine.isWorkflowComplete(projectId)) {
      const wfState = workflowEngine.getWorkflowState(projectId)
      if (wfState) wfState.canResume = false
    }
    projectService.updateProjectStatus(projectId, 'completed')
  } catch (error) {
    console.error('[Orchestrator] Pipeline failed:', error)
    projectService.updateProjectStatus(projectId, 'draft')
    throw error
  }
```

**Key parallel group**: `['integrity_reviewing', 'aigc_detecting', 'charting']` — these three stages now run concurrently instead of sequentially.

---

## Task 5: Update Agents to Use Tiered LLM

**Files:**
- Modify: `api/agents/keywordAgent.ts` — use `callTieredLLM(prompt, systemPrompt, 'light')`
- Modify: `api/agents/extractAgent.ts` — use `callTieredLLM(prompt, systemPrompt, 'heavy')`
- Modify: `api/agents/sectionPlanner.ts` — use `callTieredLLM(prompt, systemPrompt, 'light')`
- Modify: `api/agents/aigcReductionAgent.ts` — use `callTieredLLM(prompt, systemPrompt, 'medium')` instead of `callLLMWithRetry`

For each agent, find the existing LLM call and replace with the appropriate tiered call.

---

## Task 6: Fixed Citation Numbering + Literature Summary Caching

**Files:**
- Modify: `api/agents/orchestrator.ts` — assign citation numbers after papers are selected
- Modify: `api/agents/writingAgent.ts` — use cached summaries instead of full abstracts

In orchestrator.ts, after the `searching` stage completes (after `projectService.addPapers`), add:

```typescript
import * as paperLibraryService from '../services/paperLibraryService.js'
import * as knowledgeBaseService from '../services/knowledgeBaseService.js'
```

After papers are selected in the searching stage, add:
```typescript
const allPapers = projectService.getPapers(projectId)
paperLibraryService.assignCitationNumbers(projectId, allPapers)
```

In writingAgent.ts, before calling `formatPaperEvidenceList`, check for cached summaries:
```typescript
import * as paperLibraryService from '../services/paperLibraryService.js'

// In the section writing loop, before formatting papers:
const papersWithSummaries = papers.map(p => {
  const cachedSummary = paperLibraryService.getCachedSummary(p.projectId || '', p.id)
  if (cachedSummary) {
    return { ...p, abstract: cachedSummary }
  }
  return p
})
```

---

## Task 7: End-to-end Verification

- Run `npx tsc --noEmit`
- Run `npm run build`
- Start server and test API endpoints

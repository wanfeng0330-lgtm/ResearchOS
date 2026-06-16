import { getCached, setCached } from './llmCache.js'
import { getLLMSemaphore } from './semaphore.js'

const VOLCENGINE_API_KEY = process.env.VOLCENGINE_API_KEY || ''
const VOLCENGINE_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const VOLCENGINE_MODEL = 'deepseek-v3-2-251201'

function getApiKey(): string {
  return process.env.DEEPSEEK_API_KEY || ''
}

function getBaseUrl(): string {
  return process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
}

const LLM_TIMEOUT = 300000
const MAX_RETRIES = 3
const RETRY_DELAYS = [5000, 15000, 30000]

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true
    const message = error.message.toLowerCase()
    if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) return true
    if (message.includes('5') && message.includes('api error')) return true
    if (message.includes('econnreset') || message.includes('econnrefused')) return true
    if (message.includes('network') || message.includes('fetch failed')) return true
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function callLLM(prompt: string, systemPrompt?: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
  const DEEPSEEK_API_KEY = getApiKey()
  const DEEPSEEK_BASE_URL = getBaseUrl()
  const messages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  if (!DEEPSEEK_API_KEY) {
    console.error('[LLM] DEEPSEEK_API_KEY is not configured!')
    throw new Error('DeepSeek API key is not configured. Please set DEEPSEEK_API_KEY in .env file.')
  }

  const maxTokens = options?.maxTokens ?? 8192
  const temperature = options?.temperature ?? 0.7

  const cached = getCached(prompt, systemPrompt, options)
  if (cached !== null) {
    return cached
  }

  const semaphore = getLLMSemaphore()
  await semaphore.acquire()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT)

  try {
    console.log(`[LLM] Calling DeepSeek API with ${messages.length} messages, prompt length: ${prompt.length}, maxTokens: ${maxTokens}, temperature: ${temperature}`)
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[LLM] DeepSeek API error: ${response.status} - ${errorText}`)
      // On 401/402 auth/payment failure, fallback to callTieredLLM which can try other tiers
      if (response.status === 401 || response.status === 402) {
        console.warn(`[LLM] DeepSeek failed (${response.status}), falling back to tiered LLM (heavy tier)`)
        clearTimeout(timeout)
        semaphore.release()
        return callTieredLLM(prompt, systemPrompt, 'heavy', options)
      }
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    console.log(`[LLM] Response received, length: ${content.length}`)
    setCached(prompt, content, systemPrompt, options)
    return content
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[LLM] Request timed out after 300s')
      throw new Error('LLM request timed out after 300 seconds. 建议减少章节数量或降低字数要求后重试。')
    }
    throw error
  } finally {
    clearTimeout(timeout)
    semaphore.release()
  }
}

export async function callLightLLM(prompt: string, systemPrompt?: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
  const messages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  const maxTokens = options?.maxTokens ?? 2048
  const temperature = options?.temperature ?? 0.3

  const cached = getCached(prompt, systemPrompt, { ...options, maxTokens, temperature })
  if (cached !== null) {
    return cached
  }

  const semaphore = getLLMSemaphore()
  await semaphore.acquire()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)

  try {
    console.log(`[LightLLM] Calling Volcengine API, prompt length: ${prompt.length}, maxTokens: ${maxTokens}`)
    const response = await fetch(`${VOLCENGINE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VOLCENGINE_API_KEY}`,
      },
      body: JSON.stringify({
        model: VOLCENGINE_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[LightLLM] Volcengine API error: ${response.status} - ${errorText}`)
      // On 401/402 auth/payment failure, fallback to callTieredLLM
      if (response.status === 401 || response.status === 402) {
        console.warn(`[LightLLM] Volcengine failed (${response.status}), falling back to tiered LLM`)
        clearTimeout(timeout)
        semaphore.release()
        return callTieredLLM(prompt, systemPrompt, 'medium', options)
      }
      throw new Error(`Volcengine API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    console.log(`[LightLLM] Response received, length: ${content.length}`)
    setCached(prompt, content, systemPrompt, { ...options, maxTokens, temperature })
    return content
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LightLLM request timed out after 120s')
    }
    throw error
  } finally {
    clearTimeout(timeout)
    semaphore.release()
  }
}

export async function callLLMWithRetry(prompt: string, systemPrompt?: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callLLM(prompt, systemPrompt, options)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        const delay = RETRY_DELAYS[attempt]
        console.warn(`[LLM] Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${delay}ms. Error: ${lastError.message}`)
        await sleep(delay)
        continue
      }

      if (lastError.message.includes('timed out')) {
        throw new Error(`LLM 请求超时（已重试 ${attempt} 次）。建议：减少章节数量或降低字数要求后重试。`)
      }

      throw lastError
    }
  }

  throw lastError
}

export async function streamLLM(
  prompt: string,
  systemPrompt: string | undefined,
  onChunk: (chunk: string) => void
): Promise<string> {
  const DEEPSEEK_API_KEY = getApiKey()
  const DEEPSEEK_BASE_URL = getBaseUrl()
  const messages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT)

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages,
        temperature: 0.7,
        max_tokens: 8192,
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter((line) => line.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content || ''
          if (content) {
            fullContent += content
            onChunk(content)
          }
        } catch {
          continue
        }
      }
    }

    return fullContent
  } finally {
    clearTimeout(timeout)
  }
}

export type LLMTier = 'heavy' | 'medium' | 'light'

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
      model: process.env.TOKEN_PLAN_MODEL || 'mimo-v2.5-pro',
      maxTokens: 8192,
      temperature: 0.7,
      timeout: 300000,
    },
    medium: {
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_FLASH_MODEL || 'deepseek-v4-flash',
      maxTokens: 4096,
      temperature: 0.5,
      timeout: 180000,
    },
    light: {
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_FLASH_MODEL || 'deepseek-v4-flash',
      maxTokens: 4096,
      temperature: 0.3,
      timeout: 120000,
    },
  }
  return configs[tier]
}

function getFallbackOrder(tier: LLMTier): LLMTier[] {
  return tier === 'light'
    ? ['medium', 'heavy']
    : tier === 'heavy'
      ? ['medium', 'light']
      : ['heavy', 'light']
}

function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message
    return msg.includes('401') || msg.includes('402') || msg.includes('Authentication Fails') || msg.includes('invalid_request_error')
  }
  return false
}

export async function callTieredLLM(
  prompt: string,
  systemPrompt?: string,
  tier: LLMTier = 'medium',
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  let effectiveTier = tier
  let config = getTierConfig(tier)

  if (!config.apiKey) {
    const fallbackOrder = getFallbackOrder(tier)

    for (const fallback of fallbackOrder) {
      const fallbackConfig = getTierConfig(fallback)
      if (fallbackConfig.apiKey) {
        console.warn(`[TieredLLM] ${tier} tier API key not configured, falling back to ${fallback} tier`)
        effectiveTier = fallback
        config = fallbackConfig
        break
      }
    }

    if (!config.apiKey) {
      throw new Error(`No LLM API key configured for any tier. Please set at least DEEPSEEK_API_KEY in .env file.`)
    }
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
    console.log(`[TieredLLM] Calling ${effectiveTier} tier (requested: ${tier}, model: ${config.model}), prompt length: ${prompt.length}`)
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
      const apiError = new Error(`${effectiveTier} tier API error: ${response.status} - ${errorText}`)

      // On auth errors (401) or payment errors (402), try fallback tiers
      if (response.status === 401 || response.status === 402) {
        const fallbackOrder = getFallbackOrder(effectiveTier)
        for (const fallback of fallbackOrder) {
          const fallbackConfig = getTierConfig(fallback)
          if (fallbackConfig.apiKey && fallbackConfig.apiKey !== config.apiKey) {
            console.warn(`[TieredLLM] ${effectiveTier} tier auth failed (401), falling back to ${fallback} tier`)
            clearTimeout(timeout)
            semaphore.release()
            return callTieredLLM(prompt, systemPrompt, fallback, options)
          }
        }
      }

      throw apiError
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    console.log(`[TieredLLM] ${effectiveTier} tier response received, length: ${content.length}`)
    setCached(prompt, content, systemPrompt, { ...options, maxTokens, temperature })
    return content
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${effectiveTier} tier request timed out after ${config.timeout / 1000}s`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
    semaphore.release()
  }
}

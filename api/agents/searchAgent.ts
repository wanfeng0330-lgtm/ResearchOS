import {
  searchArxiv, searchSemanticScholar, searchCrossref,
  searchOpenAlex, searchPubMed, searchBioRxiv,
  enrichWithUnpaywall, scoreRelevance,
} from '../services/searchService.js'
import { aiScoreRelevance } from '../services/relevanceScorer.js'
import type { Paper } from '../../shared/types.js'

interface SourceConfig {
  searchFn: (q: string, n: number) => Promise<Paper[]>
  count: number
  queryType: 'topic' | 'keyword' | 'combined'
  priority: number
  rateLimitMs: number
  category: 'general' | 'biomedical' | 'preprint' | 'metadata'
}

const SOURCE_CONFIGS: Record<string, SourceConfig> = {
  openalex: {
    searchFn: searchOpenAlex,
    count: 25,
    queryType: 'topic',
    priority: 1,
    rateLimitMs: 500,
    category: 'general',
  },
  crossref: {
    searchFn: searchCrossref,
    count: 20,
    queryType: 'combined',
    priority: 2,
    rateLimitMs: 500,
    category: 'metadata',
  },
  pubmed: {
    searchFn: searchPubMed,
    count: 15,
    queryType: 'keyword',
    priority: 3,
    rateLimitMs: 400,
    category: 'biomedical',
  },
  semantic_scholar: {
    searchFn: searchSemanticScholar,
    count: 15,
    queryType: 'keyword',
    priority: 4,
    rateLimitMs: 2000,
    category: 'general',
  },
  biorxiv: {
    searchFn: searchBioRxiv,
    count: 10,
    queryType: 'keyword',
    priority: 5,
    rateLimitMs: 500,
    category: 'preprint',
  },
  arxiv: {
    searchFn: searchArxiv,
    count: 10,
    queryType: 'keyword',
    priority: 6,
    rateLimitMs: 3000,
    category: 'preprint',
  },
}

const TARGET_SELECT = 30

export async function execute(query: string, keywords?: string[], sources?: string[]): Promise<Paper[]> {
  const availableSources = Object.keys(SOURCE_CONFIGS)
  const activeSources = (sources || availableSources).filter((s) => availableSources.includes(s))
  const uniqueKeywords = Array.from(new Set((keywords || []).map((k) => k.trim()).filter(Boolean)))

  const sortedSources = activeSources.sort((a, b) => (SOURCE_CONFIGS[a]?.priority || 99) - (SOURCE_CONFIGS[b]?.priority || 99))

  console.log(`[SearchAgent] Starting search across ${sortedSources.length} databases`)
  console.log(`[SearchAgent] Sources (by priority): ${sortedSources.map(s => `${s}(${SOURCE_CONFIGS[s]?.count})`).join(' → ')}`)
  console.log(`[SearchAgent] Query: "${query}", Keywords: [${uniqueKeywords.join(', ')}]`)

  const topicQuery = query
  const keywordQuery = uniqueKeywords.length > 0 ? uniqueKeywords.slice(0, 5).join(' ') : query
  const combinedQuery = uniqueKeywords.length > 0 ? `${query} ${uniqueKeywords.slice(0, 3).join(' ')}` : query

  const queryMap: Record<string, string> = {
    topic: topicQuery,
    keyword: keywordQuery,
    combined: combinedQuery,
  }

  const allResults: Paper[] = []
  const sourceCounts: Record<string, number> = {}
  const failedSources: string[] = []

  for (const source of sortedSources) {
    const config = SOURCE_CONFIGS[source]
    if (!config) continue

    if (allResults.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, config.rateLimitMs))
    }

    const searchQuery = queryMap[config.queryType] || topicQuery

    try {
      console.log(`[SearchAgent] Searching ${source} [${config.category}] with "${searchQuery.substring(0, 60)}..."`)
      const results = await config.searchFn(searchQuery, config.count)
      sourceCounts[source] = results.length
      allResults.push(...results)
      console.log(`[SearchAgent] ${source}: ${results.length} papers`)
    } catch (error) {
      console.error(`[SearchAgent] ${source} failed:`, error instanceof Error ? error.message : error)
      sourceCounts[source] = 0
      failedSources.push(source)
    }
  }

  if (failedSources.length > 0) {
    const fallbackCount = failedSources.reduce((sum, s) => sum + (SOURCE_CONFIGS[s]?.count || 10), 0)
    console.log(`[SearchAgent] Fallback: compensating ${failedSources.join(', ')} with OpenAlex (+${fallbackCount})`)
    try {
      const fallbackResults = await searchOpenAlex(keywordQuery, fallbackCount)
      const newPapers = fallbackResults.filter((fp) =>
        !allResults.some((ep) => ep.title.toLowerCase().trim() === fp.title.toLowerCase().trim())
      )
      sourceCounts['openalex_fallback'] = newPapers.length
      allResults.push(...newPapers)
      console.log(`[SearchAgent] OpenAlex fallback: ${newPapers.length} additional papers`)
    } catch (error) {
      console.error('[SearchAgent] Fallback failed:', error instanceof Error ? error.message : error)
    }
  }

  const seen = new Set<string>()
  const unique: Paper[] = []
  for (const paper of allResults) {
    const key = `${paper.title.toLowerCase().trim()}_${paper.year}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(paper)
    }
  }

  console.log(`[SearchAgent] Total: ${allResults.length} retrieved, ${unique.length} after dedup`)
  console.log(`[SearchAgent] Distribution: ${Object.entries(sourceCounts).map(([s, c]) => `${s}=${c}`).join(', ')}`)

  if (unique.length === 0) {
    console.warn('[SearchAgent] No papers found')
    return []
  }

  console.log(`[SearchAgent] Running AI relevance scoring on ${unique.length} papers...`)
  console.log(`[SearchAgent] Criteria: keywordOverlap×0.25 + thematicAlignment×0.35 + methodologyCompatibility×0.20 + contributionPotential×0.20`)

  const scored = await aiScoreRelevance(unique, query, uniqueKeywords)
  const topPapers = scored.slice(0, TARGET_SELECT)

  console.log(`[SearchAgent] AI screening: selected Top ${topPapers.length}`)
  if (topPapers.length > 0) {
    console.log(`[SearchAgent] Score range: ${(topPapers[topPapers.length - 1]?.relevanceScore || 0).toFixed(2)} - ${(topPapers[0]?.relevanceScore || 0).toFixed(2)}`)
  }

  const selectedDist: Record<string, number> = {}
  for (const p of topPapers) {
    selectedDist[p.source] = (selectedDist[p.source] || 0) + 1
  }
  console.log(`[SearchAgent] Selected distribution: ${Object.entries(selectedDist).map(([s, c]) => `${s}=${c}`).join(', ')}`)

  const finalPapers = topPapers.map((paper, index) => ({
    ...paper,
    selected: (paper.relevanceScore || 0) >= 0.5,
  }))

  try {
    await enrichWithUnpaywall(finalPapers)
  } catch (e) {
    console.warn('[SearchAgent] Unpaywall enrichment skipped:', e instanceof Error ? e.message : e)
  }

  return finalPapers
}

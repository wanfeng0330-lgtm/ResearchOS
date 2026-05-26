import { searchAndRank } from '../services/searchService.js'
import { aiScoreRelevance } from '../services/relevanceScorer.js'
import type { Paper } from '../../shared/types.js'

export async function execute(query: string, keywords?: string[], sources?: string[]): Promise<Paper[]> {
  const uniqueKeywords = Array.from(new Set((keywords || []).map((keyword) => keyword.trim()).filter(Boolean)))
  const searchQueries = uniqueKeywords.length > 0
    ? [
        query,
        uniqueKeywords.slice(0, 5).join(' '),
        `${query} ${uniqueKeywords.slice(0, 3).join(' ')}`,
        uniqueKeywords.slice(0, 5).map((keyword) => `"${keyword}"`).join(' OR '),
      ]
    : [query]

  const allResults: Paper[] = []

  for (const q of searchQueries.filter(Boolean)) {
    try {
      const results = await searchAndRank(q, 15, sources)
      allResults.push(...results)
    } catch (error) {
      console.error(`[SearchAgent] Search failed for query "${q}":`, error instanceof Error ? error.message : error)
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

  const targetRetrieve = 45
  const candidates = unique.slice(0, targetRetrieve)

  console.log(`[SearchAgent] Retrieved ${candidates.length} unique papers, running AI relevance scoring...`)

  const scored = await aiScoreRelevance(candidates, query, uniqueKeywords)

  const targetSelect = 25
  const topPapers = scored.slice(0, targetSelect)

  return topPapers.map((paper, index) => ({
    ...paper,
    selected: index < Math.min(16, topPapers.length) || (paper.relevanceScore || 0) >= 0.6,
  }))
}

import { callTieredLLM } from './llmService.js'
import type { Paper } from '../../shared/types.js'
import { scoreRelevance } from './searchService.js'

interface AIRelevanceResult {
  index: number
  title: string
  relevanceScore: number
  keywordOverlap: number
  thematicAlignment: number
  methodologyCompatibility: number
  contributionPotential: number
  reason: string
}

export async function aiScoreRelevance(
  papers: Paper[],
  topic: string,
  keywords: string[] = []
): Promise<Paper[]> {
  if (papers.length === 0) return []

  const baseScored = scoreRelevance(papers, topic)

  const batchSize = 15
  const allAIResults: AIRelevanceResult[] = []

  for (let i = 0; i < baseScored.length; i += batchSize) {
    const batch = baseScored.slice(i, i + batchSize)
    const paperList = batch.map((p, idx) =>
      `[${i + idx}] "${p.title}" (${p.year}) - ${(p.abstract || '').slice(0, 200)}`
    ).join('\n')

    const prompt = `You are an expert academic literature relevance assessor. Given a research topic and a list of papers, evaluate each paper's relevance using four criteria on a 0-1 scale:

1. **keywordOverlap** (0-1): How many key terms from the topic/keywords appear in the paper title?
2. **thematicAlignment** (0-1): Does the paper's research theme directly align with the topic?
3. **methodologyCompatibility** (0-1): Is the paper's likely methodology compatible with research on this topic?
4. **contributionPotential** (0-1): How much could this paper contribute to understanding or advancing the topic?

Research Topic: "${topic}"
Keywords: ${keywords.length > 0 ? keywords.join(', ') : 'N/A'}

Papers:
${paperList}

Respond with ONLY a valid JSON array. Each element must have:
- "index": number (the [N] index from the list)
- "relevanceScore": number (weighted average: keywordOverlap*0.25 + thematicAlignment*0.35 + methodologyCompatibility*0.2 + contributionPotential*0.2)
- "keywordOverlap": number (0-1)
- "thematicAlignment": number (0-1)
- "methodologyCompatibility": number (0-1)
- "contributionPotential": number (0-1)
- "reason": string (one short sentence explaining the score)

Example: [{"index":0,"relevanceScore":0.85,"keywordOverlap":0.9,"thematicAlignment":0.8,"methodologyCompatibility":0.85,"contributionPotential":0.85,"reason":"Directly addresses the core topic with compatible methodology"}]

JSON array:`

    try {
      const response = await callTieredLLM(prompt, 'You are a precise JSON-only responder. Output only valid JSON arrays.', 'light', { maxTokens: 2048, temperature: 0.1 })
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned) as AIRelevanceResult[]
      allAIResults.push(...parsed)
    } catch (err) {
      console.warn('[RelevanceScorer] AI scoring batch failed, using base scores:', err instanceof Error ? err.message : err)
      for (let j = 0; j < batch.length; j++) {
        allAIResults.push({
          index: i + j,
          title: batch[j].title,
          relevanceScore: batch[j].relevanceScore || 0.3,
          keywordOverlap: 0.3,
          thematicAlignment: 0.3,
          methodologyCompatibility: 0.3,
          contributionPotential: 0.3,
          reason: 'Base keyword score (AI scoring unavailable)',
        })
      }
    }
  }

  const aiScoreMap = new Map<number, AIRelevanceResult>()
  for (const r of allAIResults) {
    aiScoreMap.set(r.index, r)
  }

  const enriched = baseScored.map((paper, index) => {
    const aiResult = aiScoreMap.get(index)
    if (aiResult) {
      return {
        ...paper,
        relevanceScore: aiResult.relevanceScore,
        aiScores: {
          keywordOverlap: aiResult.keywordOverlap,
          thematicAlignment: aiResult.thematicAlignment,
          methodologyCompatibility: aiResult.methodologyCompatibility,
          contributionPotential: aiResult.contributionPotential,
          reason: aiResult.reason,
        },
      }
    }
    return paper
  })

  enriched.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))

  return enriched
}

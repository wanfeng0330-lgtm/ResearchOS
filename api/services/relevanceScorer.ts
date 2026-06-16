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

export interface ScreeningReport {
  totalCandidates: number
  selectionCriteria: string
  criteriaWeights: {
    keywordOverlap: number
    thematicAlignment: number
    methodologyCompatibility: number
    contributionPotential: number
  }
  aiBatchesProcessed: number
  aiBatchesFailed: number
  fallbackUsed: boolean
  scoreDistribution: {
    min: number
    max: number
    mean: number
    median: number
  }
}

export async function aiScoreRelevance(
  papers: Paper[],
  topic: string,
  keywords: string[] = []
): Promise<Paper[]> {
  if (papers.length === 0) return []

  const baseScored = scoreRelevance(papers, topic)

  const batchSize = 20
  const allAIResults: AIRelevanceResult[] = []
  let aiBatchesProcessed = 0
  let aiBatchesFailed = 0

  for (let i = 0; i < baseScored.length; i += batchSize) {
    const batch = baseScored.slice(i, i + batchSize)
    const paperList = batch.map((p, idx) => {
      const parts = [`[${i + idx}] "${p.title}" (${p.year}) [${p.source}]`]
      if (p.journal) parts.push(`Journal: ${p.journal}`)
      if (p.keywords && p.keywords.length > 0) parts.push(`Keywords: ${p.keywords.slice(0, 5).join(', ')}`)
      if (p.abstract) parts.push(`Abstract: ${p.abstract.slice(0, 400)}`)
      return parts.join(' | ')
    }).join('\n')

    const prompt = `You are an expert academic literature relevance assessor. Given a research topic and a list of papers, evaluate each paper's relevance using four criteria on a 0-1 scale:

1. **keywordOverlap** (weight: 0.25): How many key terms from the topic/keywords appear in the paper title and abstract?
2. **thematicAlignment** (weight: 0.35): Does the paper's research theme directly align with the topic? Is it addressing the same research problem?
3. **methodologyCompatibility** (weight: 0.20): Is the paper's likely methodology compatible with research on this topic?
4. **contributionPotential** (weight: 0.20): How much could this paper contribute to understanding or advancing the topic?

Selection criteria formula: relevanceScore = keywordOverlap×0.25 + thematicAlignment×0.35 + methodologyCompatibility×0.20 + contributionPotential×0.20

Research Topic: "${topic}"
Keywords: ${keywords.length > 0 ? keywords.join(', ') : 'N/A'}

Papers:
${paperList}

Respond with ONLY a valid JSON array. Each element must have:
- "index": number (the [N] index from the list)
- "relevanceScore": number (weighted average per formula above, 0-1)
- "keywordOverlap": number (0-1)
- "thematicAlignment": number (0-1)
- "methodologyCompatibility": number (0-1)
- "contributionPotential": number (0-1)
- "reason": string (one concise sentence explaining the score based on the four criteria)

Example: [{"index":0,"relevanceScore":0.85,"keywordOverlap":0.9,"thematicAlignment":0.8,"methodologyCompatibility":0.85,"contributionPotential":0.85,"reason":"Directly addresses the core topic with compatible methodology"}]

JSON array:`

    try {
      const response = await callTieredLLM(prompt, 'You are a precise JSON-only responder. Output only valid JSON arrays.', 'light', { maxTokens: 8192, temperature: 0.1 })
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found in response')
      const parsed = JSON.parse(jsonMatch[0]) as AIRelevanceResult[]
      allAIResults.push(...parsed)
      aiBatchesProcessed++
    } catch (err) {
      console.warn(`[RelevanceScorer] AI scoring batch ${Math.floor(i / batchSize) + 1} failed, using base scores:`, err instanceof Error ? err.message : err)
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
      aiBatchesFailed++
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

  const scores = enriched.map((p) => p.relevanceScore || 0)
  const report: ScreeningReport = {
    totalCandidates: papers.length,
    selectionCriteria: 'keywordOverlap×0.25 + thematicAlignment×0.35 + methodologyCompatibility×0.20 + contributionPotential×0.20',
    criteriaWeights: {
      keywordOverlap: 0.25,
      thematicAlignment: 0.35,
      methodologyCompatibility: 0.20,
      contributionPotential: 0.20,
    },
    aiBatchesProcessed,
    aiBatchesFailed,
    fallbackUsed: aiBatchesFailed > 0,
    scoreDistribution: {
      min: Math.min(...scores),
      max: Math.max(...scores),
      mean: scores.reduce((a, b) => a + b, 0) / scores.length,
      median: scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)],
    },
  }

  console.log(`[RelevanceScorer] Screening report:`, JSON.stringify(report, null, 2))

  return enriched
}

import { callLightLLM, callTieredLLM } from '../services/llmService.js'
import { buildResearchSystemPrompt, formatPaperEvidenceList } from './researchSkillGuidance.js'
import type { Paper } from '../../shared/types.js'

export async function execute(papers: Paper[], topic: string): Promise<string[]> {
  const papersWithAbstract = papers.filter((p) => p.abstract && p.abstract.length > 20)
  if (papersWithAbstract.length === 0) return []

  const paperSummaries = formatPaperEvidenceList(papersWithAbstract)

  const systemPrompt = `${buildResearchSystemPrompt('an expert academic research analyst')}

Task:
- Extract specific, substantive viewpoints, findings, methods, contradictions, and gaps that can support a literature review.
- Each viewpoint must be traceable to at least one source marker, e.g. [1].
- Distinguish what the source claims from what can be inferred.
- Do not invent findings beyond the supplied titles and abstracts.
- Output one viewpoint per line with no extra commentary.`

  const prompt = `Topic: ${topic}

Papers:
${paperSummaries}

Extract the key viewpoints and findings from these papers related to "${topic}". Output one viewpoint per line with paper reference numbers at the end.`

  const response = await callTieredLLM(prompt, systemPrompt, 'heavy', { maxTokens: 4096, temperature: 0.4 })
  const viewpoints = response
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 10)

  return viewpoints
}

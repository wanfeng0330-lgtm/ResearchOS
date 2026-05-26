import { callLightLLM, callTieredLLM } from '../services/llmService.js'
import { ACADEMIC_RESEARCH_PROTOCOL } from './researchSkillGuidance.js'
import type { SectionConfig } from '../../shared/types.js'

export async function execute(
  topic: string,
  description: string,
  totalWordCount: number,
  language: string
): Promise<SectionConfig[]> {
  const langInstruction = language === 'zh'
    ? 'All section titles must be in Simplified Chinese.'
    : 'All section titles must be in English.'

  const maxTotalWords = Math.round(totalWordCount * 1.3)

  const systemPrompt = `You are an academic paper structure architect.
${langInstruction}
Use the Academic Research Skills structure discipline:
${ACADEMIC_RESEARCH_PROTOCOL}

Return ONLY a valid JSON array of section objects. Each object must have:
- type: snake_case identifier
- title: section title
- enabled: boolean, always true
- wordCount: number, with the sum approximately equal to ${totalWordCount}
- order: 0-based index

【STRICT WORD COUNT RULES】
- The SUM of all section wordCount values MUST be between ${totalWordCount} and ${maxTotalWords}. This is a hard limit.
- Each section's wordCount represents the TARGET for that section. The actual generated content must stay within ±30% of this target.
- Do NOT allocate more words than necessary. If the total exceeds ${maxTotalWords}, reduce proportionally.
- The wordCount values you assign will be enforced as hard limits during content generation.

Rules:
- The first section MUST be "abstract" (摘要) with type "abstract" and approximately 400 words/characters.
- The second section must be introduction (引言).
- The final section must be conclusion (结论).
- Include a limitations section unless the project is explicitly only a short brief.
- Prefer a structure that fits the research design instead of always using IMRaD.
- Use Chinese section titles when the language is Chinese.`

  const prompt = `Topic: ${topic}
Description: ${description || topic}
Total word count target: ${totalWordCount}
Maximum total word count: ${maxTotalWords} (HARD LIMIT — the sum of all wordCount values MUST NOT exceed this)
Language: ${language}

Plan the optimal academic paper structure. The first section must be an abstract (摘要). Choose middle sections that fit the topic, such as literature review, conceptual framework, methodology, findings, comparative analysis, discussion, limitations, implications, or policy recommendations.

CRITICAL: The sum of all section wordCount values must be between ${totalWordCount} and ${maxTotalWords}. Do NOT exceed ${maxTotalWords}.

Return only JSON.`

  const response = await callTieredLLM(prompt, systemPrompt, 'light', { maxTokens: 2048, temperature: 0.3 })
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return parsed.map((section: Partial<SectionConfig>, index: number) => ({
        type: section.type || `section_${index}`,
        title: section.title || `Section ${index + 1}`,
        enabled: true,
        wordCount: Math.max(200, Number(section.wordCount) || 500),
        order: index,
      }))
    }
  } catch (error) {
    console.warn('[SectionPlanner] Failed to parse LLM section plan, using fallback:', error instanceof Error ? error.message : error)
  }

  return getDefaultSections(totalWordCount, language)
}

function getDefaultSections(totalWordCount: number, language: string): SectionConfig[] {
  const isZh = language === 'zh'
  return [
    { type: 'abstract', title: isZh ? '摘要' : 'Abstract', enabled: true, wordCount: Math.round(totalWordCount * 0.05), order: 0 },
    { type: 'introduction', title: isZh ? '引言' : 'Introduction', enabled: true, wordCount: Math.round(totalWordCount * 0.13), order: 1 },
    { type: 'related_work', title: isZh ? '文献综述' : 'Literature Review', enabled: true, wordCount: Math.round(totalWordCount * 0.21), order: 2 },
    { type: 'methodology', title: isZh ? '研究方法' : 'Methodology', enabled: true, wordCount: Math.round(totalWordCount * 0.17), order: 3 },
    { type: 'findings', title: isZh ? '研究发现' : 'Findings', enabled: true, wordCount: Math.round(totalWordCount * 0.17), order: 4 },
    { type: 'discussion', title: isZh ? '讨论' : 'Discussion', enabled: true, wordCount: Math.round(totalWordCount * 0.13), order: 5 },
    { type: 'limitations', title: isZh ? '局限性' : 'Limitations', enabled: true, wordCount: Math.round(totalWordCount * 0.06), order: 6 },
    { type: 'conclusion', title: isZh ? '结论' : 'Conclusion', enabled: true, wordCount: Math.round(totalWordCount * 0.08), order: 7 },
  ]
}

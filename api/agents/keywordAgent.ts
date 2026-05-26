import { callLightLLM, callTieredLLM } from '../services/llmService.js'

export interface KeywordResult {
  mainKeywords: string[]
  secondaryKeywords: string[]
  researchFields: string[]
}

export async function execute(topic: string, description: string): Promise<KeywordResult> {
  const input = description || topic
  const systemPrompt = `You are an expert academic research strategist. Extract search-ready keywords for rigorous literature discovery. Include synonyms, domain vocabulary, methodology terms, and related constructs. Prefer terms that work across Semantic Scholar, Crossref, and arXiv. You must output valid JSON only, no other text.`
  const prompt = `Extract keywords from this research topic:\n\nTitle: ${topic}\nDescription: ${input}\n\nReturn a JSON object with exactly these fields:\n- "mainKeywords": array of 3-5 core keywords (most important terms)\n- "secondaryKeywords": array of 5-8 related secondary keywords\n- "researchFields": array of 2-3 broader research field names\n\nOutput ONLY the JSON object, no markdown, no explanation.`
  const response = await callTieredLLM(prompt, systemPrompt, 'light', { maxTokens: 1024, temperature: 0.3 })
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    const words = input.split(/\s+/).filter(w => w.length > 2)
    return {
      mainKeywords: words.slice(0, 3),
      secondaryKeywords: words.slice(3, 8),
      researchFields: [topic],
    }
  }
}

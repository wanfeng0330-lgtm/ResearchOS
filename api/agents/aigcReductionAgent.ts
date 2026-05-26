import { callLLMWithRetry, callTieredLLM } from '../services/llmService.js'
import type { GeneratedSection } from '../../shared/types.js'

const AIGC_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /首先[，,].*?其次[，,].*?最后/m, description: '模板化递进结构' },
  { pattern: /总而言之|综上所述|总体而言|总的来说/, description: '模板化总结词' },
  { pattern: /值得注意的是|需要指出的是|应当注意的是/, description: '模板化过渡句' },
  { pattern: /在.*?方面|在.*?领域|在.*?背景下/, description: '模板化介词短语' },
  { pattern: /发挥着.*?作用|提供了.*?支撑|奠定了.*?基础/, description: '模板化谓语搭配' },
  { pattern: /日益.*?越来越.*?不断/, description: '重复程度副词' },
  { pattern: /具有重要意义|具有重要价值|具有关键作用/, description: '模板化评价句' },
  { pattern: /然而[，,].*?但是[，,]|虽然.*?但是.*?然而/, description: '冗余转折' },
  { pattern: /本文.*?旨在.*?通过.*?从而/, description: '模板化目的句' },
  { pattern: /随着.*?的发展[，,].*?已经成为/, description: '模板化开篇' },
]

export function detectAigcPatterns(content: string): Array<{ pattern: string; count: number }> {
  const results: Array<{ pattern: string; count: number }> = []
  for (const { pattern, description } of AIGC_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      results.push({ pattern: description, count: matches.length })
    }
  }
  return results
}

export interface AigcReductionResult {
  sections: GeneratedSection[]
  totalPatterns: number
  reducedPatterns: number
  details: Array<{ sectionTitle: string; before: number; after: number }>
}

export async function execute(
  sections: GeneratedSection[],
  language: 'en' | 'zh' = 'en'
): Promise<AigcReductionResult> {
  const details: Array<{ sectionTitle: string; before: number; after: number }> = []
  let totalPatterns = 0
  let reducedPatterns = 0
  const isZh = language === 'zh'

  const updatedSections = await Promise.all(
    sections.map(async (section) => {
      const beforePatterns = detectAigcPatterns(section.content)
      const beforeCount = beforePatterns.reduce((sum, p) => sum + p.count, 0)
      totalPatterns += beforeCount

      if (beforeCount === 0) {
        details.push({ sectionTitle: section.title, before: 0, after: 0 })
        return section
      }

      const patternList = beforePatterns.map((p) => `- ${p.pattern} (${p.count}处)`).join('\n')

      const systemPrompt = isZh
        ? `你是一位学术论文润色专家，专门降低文本的AI生成特征（AIGC痕迹）。

修改原则：
1. 打破模板化表达：将"首先...其次...最后"等递进结构替换为更自然的论述方式
2. 替换套话：将"值得注意的是"、"总而言之"等替换为更具体、更学术化的表达
3. 增加具体性：用具体数据、案例或文献支撑替代空泛的评价
4. 变换句式：将连续的相同句式结构改为多样化的表达
5. 保持学术性：修改后的文本必须保持学术写作的严谨性和专业性
6. 保留引用：所有[n]引用标记必须原样保留，不得删除或修改
7. 保留标题：所有markdown标题格式必须保留

只返回修改后的文本，不要添加任何解释或说明。`
        : `You are an academic paper polishing expert specializing in reducing AI-generated content (AIGC) characteristics.

Principles:
1. Break template expressions: Replace formulaic structures with more natural discourse
2. Replace clichés: Substitute generic phrases with more specific, academic expressions
3. Increase specificity: Replace vague evaluations with concrete data, cases, or literature support
4. Vary sentence structures: Change repetitive sentence patterns to diverse expressions
5. Maintain academic rigor: The revised text must maintain the rigor and professionalism of academic writing
6. Preserve citations: All [n] citation markers must be kept exactly as they are
7. Preserve headings: All markdown heading formats must be retained

Return only the revised text without any explanations.`

      const prompt = isZh
        ? `请降低以下学术文本的AI生成痕迹。\n\n检测到的AIGC模式：\n${patternList}\n\n原文：\n${section.content}\n\n请重写以上文本，消除AI生成痕迹，使其读起来更像人类学者撰写的学术论文。保留所有[n]引用标记和markdown标题。`
        : `Please reduce the AI-generated content characteristics in the following academic text.\n\nDetected AIGC patterns:\n${patternList}\n\nOriginal text:\n${section.content}\n\nRewrite the text above to eliminate AI-generated traces, making it read more like a paper written by a human scholar. Preserve all [n] citation markers and markdown headings.`

      try {
        const revisedContent = await callTieredLLM(prompt, systemPrompt, 'medium', { maxTokens: 4096, temperature: 0.5 })
        const afterPatterns = detectAigcPatterns(revisedContent)
        const afterCount = afterPatterns.reduce((sum, p) => sum + p.count, 0)
        reducedPatterns += (beforeCount - afterCount)

        details.push({ sectionTitle: section.title, before: beforeCount, after: afterCount })

        return { ...section, content: revisedContent }
      } catch {
        details.push({ sectionTitle: section.title, before: beforeCount, after: beforeCount })
        return section
      }
    })
  )

  return {
    sections: updatedSections,
    totalPatterns,
    reducedPatterns,
    details,
  }
}

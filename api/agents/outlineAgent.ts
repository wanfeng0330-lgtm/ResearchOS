import { callTieredLLM } from '../services/llmService.js'
import type { SectionConfig, PaperType } from '../../shared/types.js'

export interface OutlineSection extends SectionConfig {
  keyPoints: string[]
  sourceHints: string[]
}

export interface OutlineResult {
  sections: OutlineSection[]
  totalWordCount: number
  rationale: string
}

export async function execute(
  topic: string,
  viewpoints: string[],
  totalWordCount: number,
  language: 'en' | 'zh',
  paperType: PaperType = 'graduation',
  paperCount: number = 0
): Promise<OutlineResult> {
  const langInstruction = language === 'zh'
    ? 'All section titles and key points must be in Simplified Chinese.'
    : 'All section titles and key points must be in English.'

  const maxTotalWords = Math.round(totalWordCount * 1.3)

  const viewpointList = viewpoints.length > 0
    ? viewpoints.slice(0, 20).map((v, i) => `  ${i + 1}. ${v}`).join('\n')
    : '  (No specific viewpoints extracted yet)'

  const systemPrompt = `You are an expert academic paper outline architect. You design paper structures that are driven by the ACTUAL CONTENT (viewpoints and findings) rather than generic templates.

${langInstruction}

CRITICAL DESIGN PRINCIPLES:
- The outline must be CONTENT-DRIVEN: structure sections around the actual viewpoints and findings, not around a generic template.
- Each section should address specific viewpoints. Distribute viewpoints across sections naturally.
- Word count allocation should reflect content density: sections with more viewpoints or richer evidence get more words.
- Avoid one-size-fits-all structures. A paper with 3 strong empirical findings needs a different structure than one with 10 weak correlations.
- The first section MUST be "abstract" (摘要) with type "abstract".
- The second section must be introduction (引言).
- The final section must be conclusion (结论).

Return ONLY a valid JSON object with this exact structure:
{
  "sections": [
    {
      "type": "snake_case identifier",
      "title": "section title",
      "enabled": true,
      "wordCount": number,
      "order": 0,
      "keyPoints": ["point 1 this section will address", "point 2"],
      "sourceHints": ["which viewpoints/findings this section draws from"]
    }
  ],
  "totalWordCount": number (sum of all wordCount values),
  "rationale": "one paragraph explaining why this structure was chosen over alternatives"
}

WORD COUNT RULES:
- The SUM of all section wordCount values MUST be between ${totalWordCount} and ${maxTotalWords}.
- Each section's wordCount represents the TARGET for that section.
- Allocate more words to sections with denser content requirements.
- Each section must have a minimum of 100 words.
- The abstract should be 300-500 words.
- The introduction should be 600-1200 words depending on complexity.
- The conclusion should be 500-800 words.`

  const prompt = `Topic: ${topic}
Paper type: ${paperType}
Total word count target: ${totalWordCount}
Maximum total word count: ${maxTotalWords}
Language: ${language}
Available literature count: ${paperCount} papers

Extracted viewpoints and findings:
${viewpointList}

Based on these viewpoints and findings, design an optimal paper outline. Each section's keyPoints should reference specific viewpoints by number (e.g., "Addresses viewpoint 3 and 5"). The structure should flow naturally from the content, not force content into a rigid template.

If viewpoints suggest empirical findings, include a dedicated findings/results section. If they suggest theoretical analysis, include a conceptual framework section. If they suggest comparisons, include a comparative analysis section. Let the CONTENT determine the STRUCTURE.

Return only JSON.`

  const response = await callTieredLLM(prompt, systemPrompt, 'light', { maxTokens: 4096, temperature: 0.3 })

  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length >= 3) {
      const sections: OutlineSection[] = parsed.sections.map((section: any, index: number) => ({
        type: section.type || `section_${index}`,
        title: section.title || `Section ${index + 1}`,
        enabled: true,
        wordCount: Math.max(100, Number(section.wordCount) || 500),
        order: index,
        keyPoints: Array.isArray(section.keyPoints) ? section.keyPoints : [],
        sourceHints: Array.isArray(section.sourceHints) ? section.sourceHints : [],
      }))

      const actualTotal = sections.reduce((sum, s) => sum + s.wordCount, 0)
      if (actualTotal > maxTotalWords) {
        const ratio = totalWordCount / actualTotal
        sections.forEach(s => {
          s.wordCount = Math.max(100, Math.round(s.wordCount * ratio))
        })
      }

      return {
        sections,
        totalWordCount: sections.reduce((sum, s) => sum + s.wordCount, 0),
        rationale: parsed.rationale || 'Structure designed based on extracted viewpoints and findings.',
      }
    }
  } catch (error) {
    console.warn('[OutlineAgent] Failed to parse LLM outline, using fallback:', error instanceof Error ? error.message : error)
  }

  return getFallbackOutline(topic, viewpoints, totalWordCount, language)
}

function getFallbackOutline(topic: string, viewpoints: string[], totalWordCount: number, language: 'en' | 'zh'): OutlineResult {
  const isZh = language === 'zh'
  const vpCount = viewpoints.length

  const sections: OutlineSection[] = [
    {
      type: 'abstract', title: isZh ? '摘要' : 'Abstract', enabled: true,
      wordCount: Math.round(totalWordCount * 0.05), order: 0,
      keyPoints: [isZh ? '概括研究目的、方法和主要发现' : 'Summarize research purpose, methods, and key findings'],
      sourceHints: [isZh ? '综合所有观点' : 'All viewpoints combined'],
    },
    {
      type: 'introduction', title: isZh ? '引言' : 'Introduction', enabled: true,
      wordCount: Math.round(totalWordCount * 0.12), order: 1,
      keyPoints: [isZh ? '研究背景与问题提出' : 'Research background and problem statement'],
      sourceHints: [],
    },
    {
      type: 'related_work', title: isZh ? '文献综述' : 'Literature Review', enabled: true,
      wordCount: Math.round(totalWordCount * 0.20), order: 2,
      keyPoints: viewpoints.slice(0, Math.ceil(vpCount * 0.3)).map((_, i) => isZh ? `观点 ${i + 1}` : `Viewpoint ${i + 1}`),
      sourceHints: [isZh ? '前30%观点用于文献定位' : 'First 30% viewpoints for literature positioning'],
    },
    {
      type: 'methodology', title: isZh ? '研究方法' : 'Methodology', enabled: true,
      wordCount: Math.round(totalWordCount * 0.15), order: 3,
      keyPoints: [isZh ? '研究设计与分析方法' : 'Research design and analytical methods'],
      sourceHints: [],
    },
    {
      type: 'findings', title: isZh ? '研究发现' : 'Findings', enabled: true,
      wordCount: Math.round(totalWordCount * 0.20), order: 4,
      keyPoints: viewpoints.slice(Math.ceil(vpCount * 0.3), Math.ceil(vpCount * 0.7)).map((_, i) => isZh ? `观点 ${Math.ceil(vpCount * 0.3) + i + 1}` : `Viewpoint ${Math.ceil(vpCount * 0.3) + i + 1}`),
      sourceHints: [isZh ? '核心观点用于发现阐述' : 'Core viewpoints for findings presentation'],
    },
    {
      type: 'discussion', title: isZh ? '讨论' : 'Discussion', enabled: true,
      wordCount: Math.round(totalWordCount * 0.13), order: 5,
      keyPoints: viewpoints.slice(Math.ceil(vpCount * 0.7)).map((_, i) => isZh ? `观点 ${Math.ceil(vpCount * 0.7) + i + 1}` : `Viewpoint ${Math.ceil(vpCount * 0.7) + i + 1}`),
      sourceHints: [isZh ? '剩余观点用于讨论深化' : 'Remaining viewpoints for discussion'],
    },
    {
      type: 'limitations', title: isZh ? '局限性' : 'Limitations', enabled: true,
      wordCount: Math.round(totalWordCount * 0.05), order: 6,
      keyPoints: [isZh ? '研究局限与未来方向' : 'Limitations and future directions'],
      sourceHints: [],
    },
    {
      type: 'conclusion', title: isZh ? '结论' : 'Conclusion', enabled: true,
      wordCount: Math.round(totalWordCount * 0.10), order: 7,
      keyPoints: [isZh ? '核心结论与贡献' : 'Core conclusions and contributions'],
      sourceHints: [isZh ? '综合所有观点' : 'All viewpoints synthesized'],
    },
  ]

  return {
    sections,
    totalWordCount: sections.reduce((sum, s) => sum + s.wordCount, 0),
    rationale: isZh
      ? '基于提取的观点数量和内容密度，采用标准学术结构并按比例分配字数。'
      : 'Standard academic structure with proportional word allocation based on viewpoint count and content density.',
  }
}



import { v4 as uuidv4 } from 'uuid'
import * as paperLibraryService from '../services/paperLibraryService.js'
import * as knowledgeBaseService from '../services/knowledgeBaseService.js'
import { callLLMWithRetry } from '../services/llmService.js'
import {
  buildResearchSystemPrompt,
  buildSectionInstruction,
  citationStyleInstruction,
  formatPaperEvidenceList,
  AIGC_REDUCTION_PROTOCOL,
} from './researchSkillGuidance.js'
import { selectRelevantPapers, formatPaperEvidenceList as ragFormatPaperEvidenceList } from '../services/ragService.js'
import type { GeneratedSection, Paper, CitationFormat, SectionConfig, PaperType } from '../../shared/types.js'

const SECTION_PROMPTS: Record<string, string> = {
  abstract:
    'Write a comprehensive abstract that includes: (1) research purpose and background, (2) key methods or approach, (3) main findings or results, and (4) principal conclusions and significance. The abstract must be a substantive paragraph of at least 150 words, not a single sentence. Do not use section headers within the abstract.',
  introduction:
    'Write a single concise paragraph that establishes the research context, defines the problem, identifies the research gap, and previews the contribution. Keep the introduction focused and avoid excessive background. Do not exceed one well-structured paragraph unless the topic genuinely requires more context.',
  related_work:
    'Organize related work thematically rather than paper-by-paper. Compare approaches, identify trends, disclose contradictions, and map unresolved gaps. Use ## headings for thematic sub-categories within this section.',
  methodology:
    'Describe research design, theoretical framework, data strategy, analytical method, validity criteria, and reproducibility considerations. Use ## headings for major methodological components and ### for detailed sub-steps.',
  findings:
    'Present findings cautiously and source-by-source where needed. Do not invent numerical results or datasets that are absent from the provided papers. Use ## headings for each major finding category.',
  experiments:
    'Present experimental setup, datasets, evaluation metrics, and results only when these are supported by the supplied sources or project description. Use ## headings for experimental phases and ### for individual experiments.',
  discussion:
    'Interpret implications, consider alternative explanations, connect findings to broader debates, and explicitly discuss limitations. Use ## headings for thematic discussion points.',
  limitations:
    'State methodological, evidentiary, scope, data, and generalizability limitations directly and constructively.',
  conclusion:
    'Synthesize the argument, restate the contribution conservatively, and identify evidence-based future research directions.',
}

export async function execute(
  viewpoints: string[],
  topic: string,
  citationFormat: CitationFormat,
  papers: Paper[],
  sectionConfig: SectionConfig[],
  language: 'en' | 'zh' = 'en',
  onSectionProgress?: (sectionTitle: string, sectionIndex: number, totalSections: number, completedCount: number) => void,
  totalWordCount: number = 5000,
  paperType: PaperType = 'graduation'
): Promise<GeneratedSection[]> {
  const enabledSections = sectionConfig
    .filter((section) => section.enabled)
    .sort((a, b) => a.order - b.order)

  if (enabledSections.length === 0) return []
  if (papers.length === 0) return []

  const isZh = language === 'zh'
  const projectId = papers[0]?.projectId || ''
  const papersWithSummaries = papers.map(p => {
    const cachedSummary = paperLibraryService.getCachedSummary(projectId, p.id)
    if (cachedSummary) {
      return { ...p, abstract: cachedSummary }
    }
    return p
  })
  const viewpointsText = viewpoints.length > 0
    ? viewpoints.join('\n')
    : 'No extracted viewpoints were available. Use the source abstracts conservatively.'
  const sections: GeneratedSection[] = []
  const minTotalWords = totalWordCount
  const maxTotalWords = Math.round(totalWordCount * 1.3)

  let completedSections = 0

  const sectionPromises = enabledSections.map(async (config, i) => {
    if (onSectionProgress) {
      onSectionProgress(config.title, i, enabledSections.length, completedSections)
    }

    const sectionPrompt = SECTION_PROMPTS[config.type] || buildSectionInstruction(config)

    const relevantPapers = selectRelevantPapers(papersWithSummaries, config.type, config.title, topic)
    const paperRefs = ragFormatPaperEvidenceList(relevantPapers)

    const headingInstruction = config.type === 'abstract'
      ? `Do NOT use any markdown headings (##, ###) in the abstract. Write it as continuous prose.`
      : config.type === 'introduction'
        ? `Do NOT use any markdown headings (##, ###) in the introduction. Write it as a single focused paragraph.`
        : `Use markdown heading levels for sub-sections based on content logic:
- Use ## (second-level) headings ONLY when you have at least 2 distinct sub-topics to discuss. If you cannot identify at least 2 meaningful ## sub-topics, do NOT use ## headings at all — write the section as continuous prose with natural paragraph breaks instead.
- When using ## headings, aim for 2-5 major thematic sub-topics based on content complexity and academic convention.
- Use ### (third-level) headings ONLY when you have at least 3 distinct sub-points under a ## heading. If you cannot identify at least 3 meaningful ### sub-topics, do NOT use ### headings at all — keep the content under ## headings as continuous prose with natural paragraph breaks instead.
- Use #### (fourth-level) sparingly, only for very detailed technical breakdowns.
- CRITICAL RULE for ## headings: Either use ZERO ## headings in the entire section, or use AT LEAST 2 ## headings total. Never use just 1 ## heading — this creates an unbalanced document structure.
- CRITICAL RULE for ### headings: Either use ZERO ### headings in the entire section, or use AT LEAST 3 ### headings total. Never use just 1 or 2 ### headings — this creates an unbalanced document structure.
- You must intelligently judge the heading hierarchy based on the academic content structure and logical flow. Do NOT create headings that have no content beneath them. Each heading should be followed by at least one substantive paragraph.`

    const abstractLengthRule = config.type === 'abstract'
      ? `The abstract MUST be a substantive, multi-sentence paragraph (at least 150 words / 300 Chinese characters) covering: research purpose, methods, key results, and conclusions. Do NOT write a single-sentence abstract.`
      : ''

    const introductionLengthRule = config.type === 'introduction'
      ? `The introduction should be ONE concise, well-structured paragraph. Do not split it into multiple paragraphs unless absolutely necessary.`
      : ''

    const maxSectionWords = Math.round(config.wordCount * 1.3)
    const minSectionWords = Math.round(config.wordCount * 0.7)

    const wordCountEnforcement = isZh
      ? `【字数硬性限制 — 必须严格遵守】
- 本章节目标字数：${config.wordCount}字
- 本章节允许范围：${minSectionWords}字 ~ ${maxSectionWords}字
- 全文总字数范围：${minTotalWords}字 ~ ${maxTotalWords}字
- 你必须在生成过程中主动控制字数，确保最终输出字数不超过${maxSectionWords}字
- 如果内容已充分论述，应在接近目标字数时自然收尾，不要为了凑字数而添加冗余内容
- 如果论述尚未完成但已接近上限，应精简表达、合并相似论点，确保在字数限制内完成
- 绝不允许超出上限，超出将被视为严重违规`
      : `【STRICT WORD COUNT LIMIT — MANDATORY COMPLIANCE】
- This section's target: ${config.wordCount} words
- This section's allowed range: ${minSectionWords} ~ ${maxSectionWords} words
- Total paper word count range: ${minTotalWords} ~ ${maxTotalWords} words
- You MUST actively control the word count during generation. Do NOT exceed ${maxSectionWords} words for this section.
- If the argument is sufficiently developed, conclude naturally as you approach the target. Do NOT pad with redundant content.
- If the discussion is incomplete but you are near the limit, compress your expression and merge similar points to finish within the word limit.
- Exceeding the upper limit is a CRITICAL violation and is strictly prohibited.`

    const systemPrompt = `${buildResearchSystemPrompt(
      'an expert academic writer using the Academic Research Skills writing and integrity protocol',
      language,
      paperType
    )}

${AIGC_REDUCTION_PROTOCOL}

Section task:
${sectionPrompt}
${buildSectionInstruction(config)}

${wordCountEnforcement}
${citationStyleInstruction(citationFormat)}
${headingInstruction}
${abstractLengthRule}
${introductionLengthRule}

Hard constraints:
- Use ONLY real citations from the provided paper list using [n] markers where n matches the paper number.
- Do not invent citations, authors, journals, DOIs, datasets, statistics, or results.
- If evidence is insufficient, mark the issue as a limitation or future work instead of filling the gap.
- Do not include the section header in your output.
- Do not use LaTeX commands.
- Citation markers [n] must appear as superscript-style inline references, not as full reference text.
- WORD COUNT: This section MUST be between ${minSectionWords} and ${maxSectionWords} words. The total paper MUST be between ${minTotalWords} and ${maxTotalWords} words. Exceeding these limits is NOT acceptable.`

    const prompt = `Topic: ${topic}
Section type: ${config.type}
Section title: ${config.title}
Word count limit: ${minSectionWords} ~ ${maxSectionWords} words (target: ${config.wordCount}, hard maximum: ${maxSectionWords}, DO NOT EXCEED)
Citation format: ${citationFormat}

Extracted viewpoints:
${viewpointsText}

Paper evidence list:
${paperRefs}

Write the "${config.title}" section for a research paper on "${topic}". Use [n] citation markers only for papers in the evidence list. Do not use citation numbers outside the paper list.

REMINDER: Your output MUST be between ${minSectionWords} and ${maxSectionWords} words. Stop writing when you reach the limit.`

    const content = await callLLMWithRetry(prompt, systemPrompt)
    let finalContent = content
    const actualWordCount = isZh ? content.length : content.split(/\s+/).filter(Boolean).length

    if (actualWordCount < minSectionWords * 0.5) {
      const deficit = config.wordCount - actualWordCount
      const supplementPrompt = isZh
        ? `你之前撰写的"${config.title}"章节字数不足。目标字数约${config.wordCount}字，当前仅${actualWordCount}字，还需约${deficit}字。

请继续补充以下章节的内容，要求：
1. 紧接上文内容，不要重复已有内容
2. 补充更详细的论述、分析或案例
3. 保持与上文一致的学术风格和引用格式
4. 使用[n]引用标记引用已有论文列表中的文献
5. 不要使用"首先...其次...最后"等模板化递进结构
6. 不要使用"值得注意的是"、"总而言之"等AI典型表达

已有内容：
${content}

请直接输出补充内容（不要输出已有内容）：`
        : `The "${config.title}" section you wrote is too short. Target: ~${config.wordCount} words, current: ${actualWordCount} words, need ~${deficit} more words.

Continue the section with additional content. Requirements:
1. Continue from where the previous text left off — do NOT repeat existing content
2. Add more detailed analysis, discussion, or examples
3. Maintain consistent academic style and citation format
4. Use [n] citation markers referencing papers from the evidence list
5. Do NOT use formulaic structures like "First...Second...Finally"
6. Do NOT use AI-typical expressions like "It is worth noting that" or "In summary"

Existing content:
${content}

Output only the supplementary content (not the existing content):`

      try {
        const supplement = await callLLMWithRetry(supplementPrompt, systemPrompt)
        finalContent = content + '\n\n' + supplement.trim()
      } catch (error) {
        console.warn(`[WritingAgent] Failed to supplement section "${config.title}":`, error instanceof Error ? error.message : error)
      }
    }

    if (actualWordCount > maxSectionWords * 1.5) {
      const excess = actualWordCount - maxSectionWords
      const condensePrompt = isZh
        ? `你之前撰写的"${config.title}"章节字数超标。目标字数约${config.wordCount}字，上限${maxSectionWords}字，当前${actualWordCount}字，超出约${excess}字。

请精简以下章节内容，要求：
1. 将字数压缩到${maxSectionWords}字以内
2. 删除冗余论述、重复观点和过度展开的细节
3. 保留核心论点、关键证据和所有[n]引用标记
4. 保留所有markdown标题结构
5. 保持学术严谨性和逻辑完整性
6. 不要使用"首先...其次...最后"等模板化递进结构
7. 不要使用"值得注意的是"、"总而言之"等AI典型表达

原文：
${finalContent}

请输出精简后的完整章节内容：`
        : `The "${config.title}" section you wrote exceeds the word limit. Target: ~${config.wordCount} words, maximum: ${maxSectionWords} words, current: ${actualWordCount} words, excess: ~${excess} words.

Condense the section. Requirements:
1. Reduce the word count to ${maxSectionWords} words or fewer
2. Remove redundant arguments, repetitive points, and over-expanded details
3. Preserve core arguments, key evidence, and ALL [n] citation markers
4. Preserve all markdown heading structures
5. Maintain academic rigor and logical integrity
6. Do NOT use formulaic structures like "First...Second...Finally"
7. Do NOT use AI-typical expressions like "It is worth noting that" or "In summary"

Original text:
${finalContent}

Output the condensed section in full:`

      try {
        const condensed = await callLLMWithRetry(condensePrompt, systemPrompt)
        finalContent = condensed.trim()
      } catch (error) {
        console.warn(`[WritingAgent] Failed to condense section "${config.title}":`, error instanceof Error ? error.message : error)
      }
    }

    const citedNumbers = new Set(
      Array.from(finalContent.matchAll(/\[(\d+)\]/g))
        .map((match) => Number(match[1]))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= papers.length)
    )
    const citationIndexes = citedNumbers.size > 0 ? Array.from(citedNumbers) : relevantPapers.slice(0, 3).map((p) => p._originalIndex + 1)

    const citations = citationIndexes.map((position) => {
      const paper = papers[position - 1]
      return {
        id: uuidv4(),
        paperId: paper.id,
        sectionId: '',
        format: citationFormat,
        text: `[${position}]`,
        position,
      }
    })

    const result = {
      id: uuidv4(),
      projectId: '',
      type: config.type,
      title: config.title,
      content: finalContent,
      citations,
      order: config.order,
      wordCount: isZh ? finalContent.length : finalContent.split(/\s+/).filter(Boolean).length,
    }

    completedSections++
    if (onSectionProgress) {
      onSectionProgress(config.title, i, enabledSections.length, completedSections)
    }

    return result
  })

  const resolvedSections = await Promise.all(sectionPromises)
  sections.push(...resolvedSections.sort((a, b) => a.order - b.order))

  return sections
}

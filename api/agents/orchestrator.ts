import * as keywordAgent from './keywordAgent.js'
import * as searchAgent from './searchAgent.js'
import * as parseAgent from './parseAgent.js'
import * as extractAgent from './extractAgent.js'
import * as writingAgent from './writingAgent.js'
import * as citationAgent from './citationAgent.js'
import * as integrityAgent from './integrityAgent.js'
import * as aigcReductionAgent from './aigcReductionAgent.js'
import * as chartAgent from './chartAgent.js'
import * as formatAgent from './formatAgent.js'
import * as sectionPlanner from './sectionPlanner.js'
import * as projectService from '../services/projectService.js'
import * as paperLibraryService from '../services/paperLibraryService.js'
import { DEFAULT_SECTIONS } from '../../shared/types.js'
import type { CitationFormat, AgentStage, SectionConfig, PaperType } from '../../shared/types.js'
import { PAPER_TYPE_SECTIONS } from './researchSkillGuidance.js'
import * as workflowEngine from '../services/workflowEngine.js'

export async function orchestrate(
  projectId: string,
  topic: string,
  description: string,
  citationFormat: CitationFormat,
  sectionConfig: SectionConfig[],
  autoSelectPapers: boolean,
  language: 'en' | 'zh' = 'en',
  includeToc: boolean = true,
  totalWordCount: number = 5000,
  paperType: PaperType = 'graduation'
): Promise<void> {
  let config = sectionConfig.length > 0 ? sectionConfig : DEFAULT_SECTIONS

  if (sectionConfig.length === 0 && paperType && PAPER_TYPE_SECTIONS[paperType]) {
    const typeSections = PAPER_TYPE_SECTIONS[paperType]
    const totalTypeWords = typeSections.reduce((sum, s) => sum + s.wordCount, 0)
    const ratio = totalWordCount / totalTypeWords
    config = typeSections.map((s, i) => ({
      type: s.type,
      title: s.title,
      enabled: true,
      wordCount: Math.max(100, Math.round(s.wordCount * ratio)),
      order: i,
    }))
  }
  projectService.setSectionConfig(projectId, config)

  const stages: Array<{ stage: AgentStage; progress: number; fn: () => Promise<void> }> = [
    {
      stage: 'keyword_extracting',
      progress: 5,
      fn: async () => {
        projectService.setProgress(projectId, {
          stage: 'keyword_extracting',
          progress: 5,
          message: '正在提取研究关键词和检索词...',
        })

        const result = await keywordAgent.execute(topic, description)
        const allKeywords = [...result.mainKeywords, ...result.secondaryKeywords]
        projectService.setKeywords(projectId, allKeywords)

        const totalWordCountFromConfig = config.reduce((sum, section) => sum + section.wordCount, 0) || totalWordCount
        config = await sectionPlanner.execute(topic, description, totalWordCountFromConfig, language)
        projectService.setSectionConfig(projectId, config)

        const totalPlannedWords = config.reduce((sum, section) => sum + section.wordCount, 0)
        if (totalPlannedWords > 0 && totalWordCount > 0) {
          const ratio = totalWordCount / totalPlannedWords
          config = config.map((section) => ({
            ...section,
            wordCount: Math.max(100, Math.round(section.wordCount * ratio)),
          }))
        }
        projectService.setSectionConfig(projectId, config)

        projectService.setProgress(projectId, {
          stage: 'keyword_extracting',
          progress: 12,
          message: `已提取 ${allKeywords.length} 个关键词，规划 ${config.length} 个章节。`,
        })
      },
    },
    {
      stage: 'searching',
      progress: 15,
      fn: async () => {
        projectService.updateProjectStatus(projectId, 'searching')
        projectService.setProgress(projectId, {
          stage: 'searching',
          progress: 15,
          message: '正在检索学术文献源...',
        })

        const keywords = projectService.getKeywords(projectId)
        const papers = await searchAgent.execute(topic, keywords)
        projectService.addPapers(projectId, papers)

        const allPapers = projectService.getPapers(projectId)
        paperLibraryService.assignCitationNumbers(projectId, allPapers)

        if (autoSelectPapers) {
          for (const paper of projectService.getPapers(projectId)) {
            if ((paper.relevanceScore || 0) >= 0.5) {
              paper.selected = true
            }
          }
        }

        const selectedCount = projectService.getSelectedPapers(projectId).length
        projectService.setProgress(projectId, {
          stage: 'searching',
          progress: 25,
          message: `检索到 ${papers.length} 篇文献，已筛选 ${selectedCount} 篇高相关性来源。`,
        })
      },
    },
    {
      stage: 'parsing',
      progress: 30,
      fn: async () => {
        projectService.updateProjectStatus(projectId, 'parsing')
        projectService.setProgress(projectId, {
          stage: 'parsing',
          progress: 30,
          message: '正在解析文献元数据和摘要...',
        })

        const papers = projectService.getPapers(projectId)
        const enriched = await parseAgent.execute(papers)
        projectService.addPapers(projectId, enriched)

        projectService.setProgress(projectId, {
          stage: 'parsing',
          progress: 38,
          message: '文献解析完成。',
        })
      },
    },
    {
      stage: 'extracting',
      progress: 40,
      fn: async () => {
        projectService.setProgress(projectId, {
          stage: 'extracting',
          progress: 40,
          message: '正在提取可追溯的论点、发现和研究空白...',
        })

        const papers = projectService.getSelectedPapers(projectId)
        const papersToUse = papers.length > 0 ? papers : projectService.getPapers(projectId)
        if (papersToUse.length === 0) {
          projectService.setProgress(projectId, {
            stage: 'extracting',
            progress: 48,
            message: '未找到可用文献源，生成将在撰写前停止。',
            partialContent: '',
          })
          return
        }

        const viewpoints = await extractAgent.execute(papersToUse, topic)
        projectService.setProgress(projectId, {
          stage: 'extracting',
          progress: 48,
          message: `已提取 ${viewpoints.length} 个基于文献的观点。`,
          partialContent: viewpoints.join('\n'),
        })
      },
    },
    {
      stage: 'writing',
      progress: 50,
      fn: async () => {
        projectService.updateProjectStatus(projectId, 'generating')
        projectService.setProgress(projectId, {
          stage: 'writing',
          progress: 50,
          message: '正在按照学术研究技能质量规范撰写各章节...',
        })

        const progress = projectService.getProgress(projectId)
        const viewpoints = (progress?.partialContent || '').split('\n').filter((value) => value.trim().length > 0)
        const papers = projectService.getSelectedPapers(projectId).length > 0
          ? projectService.getSelectedPapers(projectId)
          : projectService.getPapers(projectId)

        if (papers.length === 0) {
          projectService.setProgress(projectId, {
            stage: 'writing',
            progress: 65,
            message: '无可用文献源，跳过撰写以避免无支撑的论断。',
          })
          return
        }

        const generatedSections = await writingAgent.execute(
          viewpoints,
          topic,
          citationFormat,
          papers,
          config,
          language,
          (sectionTitle, sectionIndex, totalSections, completedCount) => {
            const sectionProgress = 50 + Math.floor((completedCount / totalSections) * 15)
            projectService.setProgress(projectId, {
              stage: 'writing',
              progress: sectionProgress,
              message: `正在撰写：${sectionTitle}（已完成 ${completedCount}/${totalSections}）`,
            })
          },
          totalWordCount,
          paperType
        )

        projectService.setGeneratedSections(projectId, generatedSections.map((section) => ({ ...section, projectId })))

        const totalGeneratedWords = generatedSections.reduce((sum, s) => sum + s.wordCount, 0)
        const minTarget = totalWordCount
        const maxTarget = Math.round(totalWordCount * 1.3)

        if (totalGeneratedWords < minTarget * 0.7) {
          console.warn(`[Orchestrator] Total word count ${totalGeneratedWords} is significantly below target ${minTarget}. Sections may need expansion.`)
        }

        if (totalGeneratedWords > maxTarget) {
          const excessRatio = maxTarget / totalGeneratedWords
          const sectionsToCondense = generatedSections
            .map((section, idx) => ({ section, idx, overRatio: section.wordCount / (config[idx]?.wordCount || section.wordCount) }))
            .filter((item) => item.overRatio > 1.1)
            .sort((a, b) => b.overRatio - a.overRatio)

          for (const item of sectionsToCondense) {
            const section = item.section
            const newTarget = Math.round(section.wordCount * excessRatio)
            const isZh = language === 'zh'
            const condensePrompt = isZh
              ? `以下章节字数超标，需要精简。当前${section.wordCount}字，目标${newTarget}字以内。

请精简以下内容，要求：
1. 将字数压缩到${newTarget}字以内
2. 删除冗余论述和重复观点
3. 保留核心论点、关键证据和所有[n]引用标记
4. 保留所有markdown标题结构
5. 保持学术严谨性
6. 不要使用模板化表达

原文：
${section.content}

请输出精简后的完整内容：`
              : `The following section exceeds the word limit. Current: ${section.wordCount} words, target: ${newTarget} words or fewer.

Condense the content. Requirements:
1. Reduce to ${newTarget} words or fewer
2. Remove redundant arguments and repetitive points
3. Preserve core arguments, key evidence, and ALL [n] citation markers
4. Preserve all markdown heading structures
5. Maintain academic rigor
6. Do NOT use formulaic expressions

Original text:
${section.content}

Output the condensed content in full:`

            try {
              const { callLLMWithRetry } = await import('../services/llmService.js')
              const condensed = await callLLMWithRetry(condensePrompt)
              const condensedWordCount = isZh ? condensed.length : condensed.split(/\s+/).filter(Boolean).length
              section.content = condensed.trim()
              section.wordCount = condensedWordCount
            } catch (error) {
              console.warn(`[Orchestrator] Failed to condense section "${section.title}":`, error instanceof Error ? error.message : error)
            }

            const updatedTotal = generatedSections.reduce((sum, s) => sum + s.wordCount, 0)
            if (updatedTotal <= maxTarget) break
          }

          projectService.setGeneratedSections(projectId, generatedSections.map((section) => ({ ...section, projectId })))
        }

        const finalTotalWords = generatedSections.reduce((sum, s) => sum + s.wordCount, 0)
        projectService.setProgress(projectId, {
          stage: 'writing',
          progress: 65,
          message: `已完成 ${generatedSections.length} 个章节的撰写，总字数 ${finalTotalWords}（目标 ${minTarget}-${maxTarget}）。`,
        })
      },
    },
    {
      stage: 'citing',
      progress: 70,
      fn: async () => {
        projectService.setProgress(projectId, {
          stage: 'citing',
          progress: 70,
          message: '正在格式化引用和参考文献列表...',
        })

        const generatedSections = projectService.getGeneratedSections(projectId)
        if (generatedSections.length === 0) {
          projectService.setProgress(projectId, {
            stage: 'citing',
            progress: 78,
            message: '无已生成内容，跳过引用格式化。',
          })
          return
        }

        const papers = projectService.getSelectedPapers(projectId).length > 0
          ? projectService.getSelectedPapers(projectId)
          : projectService.getPapers(projectId)
        const result = await citationAgent.execute(generatedSections, papers, citationFormat)

        projectService.setGeneratedSections(projectId, result.sections.map((section) => ({ ...section, projectId })))
        projectService.setReferences(projectId, result.references)
        projectService.setProgress(projectId, {
          stage: 'citing',
          progress: 78,
          message: `已格式化 ${result.references.length} 条参考文献。`,
        })
      },
    },
    {
      stage: 'integrity_reviewing',
      progress: 79,
      fn: async () => {
        projectService.setProgress(projectId, {
          stage: 'integrity_reviewing',
          progress: 79,
          message: '正在进行引用和论点完整性审核...',
        })

        const generatedSections = projectService.getGeneratedSections(projectId)
        const papers = projectService.getSelectedPapers(projectId).length > 0
          ? projectService.getSelectedPapers(projectId)
          : projectService.getPapers(projectId)
        const references = projectService.getReferences(projectId)
        const report = await integrityAgent.execute(generatedSections, papers, references)

        projectService.setProgress(projectId, {
          stage: 'integrity_reviewing',
          progress: 80,
          message: report.summary,
          partialContent: report.issues.map((issue) => `${issue.severity.toUpperCase()} ${issue.category}: ${issue.message}`).join('\n'),
        })

        if (!report.passed) {
          throw new Error(report.summary)
        }
      },
    },
    {
      stage: 'aigc_detecting',
      progress: 81,
      fn: async () => {
        projectService.setProgress(projectId, {
          stage: 'aigc_detecting',
          progress: 81,
          message: '正在检测AI生成痕迹...',
        })

        const generatedSections = projectService.getGeneratedSections(projectId)
        if (generatedSections.length === 0) {
          projectService.setProgress(projectId, {
            stage: 'aigc_detecting',
            progress: 85,
            message: '无已生成内容，跳过AIGC检测。',
          })
          return
        }

        try {
          const { detectAigcPatterns } = await import('./aigcReductionAgent.js')
          let totalPatterns = 0
          for (const section of generatedSections) {
            const patterns = detectAigcPatterns(section.content)
            totalPatterns += patterns.reduce((sum, p) => sum + p.count, 0)
          }

          if (totalPatterns === 0) {
            projectService.setProgress(projectId, {
              stage: 'aigc_detecting',
              progress: 85,
              message: 'AIGC检测完成：论文表达自然，无显著AI痕迹。',
            })
          } else {
            projectService.setProgress(projectId, {
              stage: 'aigc_detecting',
              progress: 85,
              message: `AIGC检测完成：发现 ${totalPatterns} 处潜在AI痕迹（已在写作阶段通过提示词优化降低）。`,
            })
          }
        } catch {
          projectService.setProgress(projectId, {
            stage: 'aigc_detecting',
            progress: 85,
            message: 'AIGC检测完成。',
          })
        }
      },
    },
    {
      stage: 'charting',
      progress: 86,
      fn: async () => {
        projectService.setProgress(projectId, {
          stage: 'charting',
          progress: 86,
          message: '正在生成研究可视化图表...',
        })

        const sectionsForCharts = projectService.getGeneratedSections(projectId)
        if (sectionsForCharts.length === 0) {
          projectService.setProgress(projectId, {
            stage: 'charting',
            progress: 90,
            message: '无已生成内容，跳过可视化图表生成。',
          })
          return
        }

        const papers = projectService.getSelectedPapers(projectId).length > 0
          ? projectService.getSelectedPapers(projectId)
          : projectService.getPapers(projectId)
        const charts = await chartAgent.execute(sectionsForCharts, papers, topic)
        const sortedSections = [...sectionsForCharts].sort((a, b) => a.order - b.order)
        const sectionIndexMap = new Map(sortedSections.map((section, index) => [section.order, index]))

        const updatedCharts = charts.map((chart) => {
          const sectionIndex = sectionIndexMap.get(chart.position)
          return sectionIndex !== undefined ? { ...chart, position: sectionIndex } : chart
        })

        const updatedSections = sectionsForCharts.map((section) => {
          const sectionIndex = sectionIndexMap.get(section.order)
          return {
            ...section,
            charts: sectionIndex === undefined ? [] : updatedCharts.filter((chart) => chart.position === sectionIndex),
          }
        })

        projectService.setGeneratedSections(projectId, updatedSections)
        projectService.setProgress(projectId, {
          stage: 'charting',
          progress: 90,
          message: `已生成 ${charts.length} 个可视化图表。`,
        })
      },
    },
    {
      stage: 'formatting',
      progress: 92,
      fn: async () => {
        projectService.setProgress(projectId, {
          stage: 'formatting',
          progress: 92,
          message: '正在组装最终排版文稿...',
        })

        const generatedSections = projectService.getGeneratedSections(projectId)
        const references = projectService.getReferences(projectId)
        const result = await formatAgent.execute(generatedSections, references, includeToc)

        projectService.setProgress(projectId, {
          stage: 'formatting',
          progress: 100,
          message: '论文生成完成。',
          partialContent: result.content,
        })
      },
    },
  ]

  workflowEngine.initWorkflowState(projectId)

  try {
    const stageMap = new Map(stages.map(s => [s.stage, s]))

    const parallelGroups: Array<Array<AgentStage>> = [
      ['keyword_extracting'],
      ['searching'],
      ['parsing'],
      ['extracting'],
      ['writing'],
      ['citing'],
      ['integrity_reviewing', 'aigc_detecting', 'charting'],
      ['formatting'],
    ]

    for (const group of parallelGroups) {
      const fns = group
        .map(stageName => stageMap.get(stageName as AgentStage))
        .filter((s): s is { stage: AgentStage; progress: number; fn: () => Promise<void> } => s !== undefined)

      if (fns.length === 0) continue

      if (fns.length === 1) {
        const { stage, progress, fn } = fns[0]
        try {
          projectService.setProgress(projectId, { stage, progress, message: `正在处理：${stage}...` })
          workflowEngine.updateStageStatus(projectId, stage, 'running')
          await fn()
          workflowEngine.updateStageStatus(projectId, stage, 'completed')
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          console.error(`[Orchestrator] Error at stage ${stage}:`, errorMsg)
          workflowEngine.updateStageStatus(projectId, stage, 'failed', errorMsg)
          const generatedSections = projectService.getGeneratedSections(projectId)
          const hasPartialContent = generatedSections.length > 0
          projectService.setProgress(projectId, {
            stage, progress,
            message: hasPartialContent
              ? `阶段 ${stage} 失败：${errorMsg}。已完成 ${generatedSections.length} 个章节的撰写已保存，可重新生成。`
              : `阶段 ${stage} 失败：${errorMsg}`,
          })
          projectService.updateProjectStatus(projectId, 'draft')
          throw error
        }
      } else {
        const results = await Promise.allSettled(
          fns.map(async ({ stage, progress, fn }) => {
            try {
              projectService.setProgress(projectId, { stage, progress, message: `正在处理：${stage}...` })
              workflowEngine.updateStageStatus(projectId, stage, 'running')
              await fn()
              workflowEngine.updateStageStatus(projectId, stage, 'completed')
              return { stage, success: true }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error'
              console.error(`[Orchestrator] Error at stage ${stage}:`, errorMsg)
              workflowEngine.updateStageStatus(projectId, stage, 'failed', errorMsg)
              return { stage, success: false, error: errorMsg }
            }
          })
        )

        const failed = results.filter((r): r is PromiseFulfilledResult<{ stage: AgentStage; success: false; error: string }> =>
          r.status === 'fulfilled' && r.value && 'success' in r.value && r.value.success === false
        )
        if (failed.length > 0) {
          const errorMsg = failed.map(f => f.value.error).join('; ')
          projectService.setProgress(projectId, {
            stage: fns[0].stage,
            progress: fns[0].progress,
            message: `并行阶段失败：${errorMsg}`,
          })
          projectService.updateProjectStatus(projectId, 'draft')
          throw new Error(`Parallel stages failed: ${errorMsg}`)
        }
      }
    }

    if (workflowEngine.isWorkflowComplete(projectId)) {
      const wfState = workflowEngine.getWorkflowState(projectId)
      if (wfState) wfState.canResume = false
    }
    projectService.updateProjectStatus(projectId, 'completed')
  } catch (error) {
    console.error('[Orchestrator] Pipeline failed:', error)
    projectService.updateProjectStatus(projectId, 'draft')
    throw error
  }
}

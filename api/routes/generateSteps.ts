import { Router, type Request, type Response } from 'express'
import * as projectService from '../services/projectService.js'
import * as keywordAgent from '../agents/keywordAgent.js'
import * as sectionPlanner from '../agents/sectionPlanner.js'
import * as searchAgent from '../agents/searchAgent.js'
import * as parseAgent from '../agents/parseAgent.js'
import * as extractAgent from '../agents/extractAgent.js'
import * as outlineAgent from '../agents/outlineAgent.js'
import * as writingAgent from '../agents/writingAgent.js'
import * as citationAgent from '../agents/citationAgent.js'
import * as integrityAgent from '../agents/integrityAgent.js'
import * as chartAgent from '../agents/chartAgent.js'
import * as formatAgent from '../agents/formatAgent.js'
import * as paperLibraryService from '../services/paperLibraryService.js'
import { PAPER_TYPE_SECTIONS } from '../agents/researchSkillGuidance.js'
import { DEFAULT_SECTIONS } from '../../shared/types.js'
import type { CitationFormat, SectionConfig, PaperType } from '../../shared/types.js'

const router = Router()

router.post('/keywords', async (req: Request, res: Response): Promise<void> => {
  const { projectId, topic, description, language, totalWordCount, paperType } = req.body as {
    projectId: string
    topic: string
    description?: string
    language?: 'en' | 'zh'
    totalWordCount?: number
    paperType?: PaperType
  }

  if (!projectId || !topic) {
    res.status(400).json({ success: false, error: 'projectId and topic are required' })
    return
  }

  const project = await projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }

  try {
    await projectService.setProgress(projectId, { stage: 'keyword_extracting', progress: 5, message: '正在提取研究关键词...' })
    const result = await keywordAgent.execute(topic, description || '')
    const allKeywords = [...result.mainKeywords, ...result.secondaryKeywords]
    await projectService.setKeywords(projectId, allKeywords)

    const lang: 'en' | 'zh' = language || 'zh'
    const wordCount = totalWordCount || 5000
    const pType: PaperType = paperType || 'graduation'

    let config: SectionConfig[] = []
    if (pType && PAPER_TYPE_SECTIONS[pType]) {
      const typeSections = PAPER_TYPE_SECTIONS[pType]
      const totalTypeWords = typeSections.reduce((sum, s) => sum + s.wordCount, 0)
      const ratio = wordCount / totalTypeWords
      config = typeSections.map((s, i) => ({
        type: s.type,
        title: s.title,
        enabled: true,
        wordCount: Math.max(100, Math.round(s.wordCount * ratio)),
        order: i,
      }))
    } else {
      config = await sectionPlanner.execute(topic, description || '', wordCount, lang)
    }

    await projectService.setSectionConfig(projectId, config)

    const totalPlannedWords = config.reduce((sum, section) => sum + section.wordCount, 0)
    if (totalPlannedWords > 0 && wordCount > 0) {
      const ratio = wordCount / totalPlannedWords
      config = config.map((section) => ({
        ...section,
        wordCount: Math.max(100, Math.round(section.wordCount * ratio)),
      }))
    }
    await projectService.setSectionConfig(projectId, config)

    await projectService.setStepData(projectId, 'keywords', {
      keywords: allKeywords,
      mainKeywords: result.mainKeywords,
      secondaryKeywords: result.secondaryKeywords,
      researchFields: result.researchFields,
      sectionConfig: config,
    })

    await projectService.setProgress(projectId, {
      stage: 'keyword_extracting',
      progress: 12,
      message: `已提取 ${allKeywords.length} 个关键词，规划 ${config.length} 个章节`,
    })

    res.json({
      success: true,
      data: {
        keywords: allKeywords,
        mainKeywords: result.mainKeywords,
        secondaryKeywords: result.secondaryKeywords,
        researchFields: result.researchFields,
        sectionConfig: config,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[StepKeywords] Error:', msg)
    res.status(500).json({ success: false, error: msg })
  }
})

router.post('/search', async (req: Request, res: Response): Promise<void> => {
  const { projectId, keywords, topic } = req.body as {
    projectId: string
    keywords?: string[]
    topic?: string
  }

  if (!projectId) {
    res.status(400).json({ success: false, error: 'projectId is required' })
    return
  }

  const project = await projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }

  try {
    await projectService.setProgress(projectId, { stage: 'searching', progress: 15, message: '正在检索学术文献...' })

    const searchKeywords = keywords || await projectService.getKeywords(projectId)
    const searchTopic = topic || project.topic
    const papers = await searchAgent.execute(searchTopic, searchKeywords)
    await projectService.addPapers(projectId, papers)

    const allPapers = await projectService.getPapers(projectId)
    paperLibraryService.assignCitationNumbers(projectId, allPapers)

    for (const paper of await projectService.getPapers(projectId)) {
      if ((paper.relevanceScore || 0) >= 0.5) {
        paper.selected = true
      }
    }

    await projectService.setProgress(projectId, { stage: 'parsing', progress: 30, message: '正在解析文献元数据...' })
    const enriched = await parseAgent.execute(await projectService.getPapers(projectId))
    await projectService.addPapers(projectId, enriched)

    const finalPapers = await projectService.getPapers(projectId)
    const selectedCount = finalPapers.filter(p => p.selected).length

    await projectService.setStepData(projectId, 'search', { papers: finalPapers })
    await projectService.setProgress(projectId, {
      stage: 'parsing',
      progress: 38,
      message: `检索到 ${finalPapers.length} 篇文献，已筛选 ${selectedCount} 篇`,
    })

    res.json({
      success: true,
      data: { papers: finalPapers },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[StepSearch] Error:', msg)
    res.status(500).json({ success: false, error: msg })
  }
})

router.post('/extract', async (req: Request, res: Response): Promise<void> => {
  const { projectId, paperIds, topic } = req.body as {
    projectId: string
    paperIds?: string[]
    topic?: string
  }

  if (!projectId) {
    res.status(400).json({ success: false, error: 'projectId is required' })
    return
  }

  const project = await projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }

  try {
    await projectService.setProgress(projectId, { stage: 'extracting', progress: 40, message: '正在提取研究观点...' })

    let papersToUse = await projectService.getSelectedPapers(projectId)
    if (papersToUse.length === 0) {
      papersToUse = await projectService.getPapers(projectId)
    }
    if (paperIds && paperIds.length > 0) {
      const allPapers = await projectService.getPapers(projectId)
      papersToUse = allPapers.filter(p => paperIds.includes(p.id))
    }

    if (papersToUse.length === 0) {
      res.json({ success: true, data: { viewpoints: [] } })
      return
    }

    const viewpoints = await extractAgent.execute(papersToUse, topic || project.topic)

    await projectService.setStepData(projectId, 'extract', { viewpoints })
    await projectService.setProgress(projectId, {
      stage: 'extracting',
      progress: 48,
      message: `已提取 ${viewpoints.length} 个观点`,
    })

    res.json({
      success: true,
      data: { viewpoints },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[StepExtract] Error:', msg)
    res.status(500).json({ success: false, error: msg })
  }
})

router.post('/outline', async (req: Request, res: Response): Promise<void> => {
  const { projectId, viewpoints, topic, totalWordCount, language, paperType, paperCount } = req.body as {
    projectId: string
    viewpoints?: string[]
    topic?: string
    totalWordCount?: number
    language?: 'en' | 'zh'
    paperType?: PaperType
    paperCount?: number
  }

  if (!projectId) {
    res.status(400).json({ success: false, error: 'projectId is required' })
    return
  }

  const project = await projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }

  try {
    await projectService.setProgress(projectId, { stage: 'extracting', progress: 49, message: '正在基于观点生成论文大纲...' })

    let viewpointsToUse = viewpoints || await projectService.getViewpoints(projectId)
    if (viewpointsToUse.length === 0) {
      const stepData = await projectService.getStepData(projectId, 'extract')
      if (stepData && typeof stepData === 'object' && stepData !== null && 'viewpoints' in stepData) {
        viewpointsToUse = (stepData as { viewpoints: string[] }).viewpoints
      }
    }

    const result = await outlineAgent.execute(
      topic || project.topic,
      viewpointsToUse,
      totalWordCount || 5000,
      language || 'zh',
      paperType || 'graduation',
      paperCount || 0
    )

    const sectionConfig = result.sections.map(s => ({
      type: s.type,
      title: s.title,
      enabled: s.enabled,
      wordCount: s.wordCount,
      order: s.order,
    }))
    await projectService.setSectionConfig(projectId, sectionConfig)

    await projectService.setStepData(projectId, 'outline', {
      sections: result.sections,
      totalWordCount: result.totalWordCount,
      rationale: result.rationale,
    })

    await projectService.setProgress(projectId, {
      stage: 'extracting',
      progress: 50,
      message: `已生成 ${result.sections.length} 个章节的大纲`,
    })

    res.json({
      success: true,
      data: {
        sections: result.sections,
        totalWordCount: result.totalWordCount,
        rationale: result.rationale,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[StepOutline] Error:', msg)
    res.status(500).json({ success: false, error: msg })
  }
})

router.post('/write', async (req: Request, res: Response): Promise<void> => {
  const {
    projectId, viewpoints, paperIds, sectionConfig, citationFormat,
    language, totalWordCount, paperType, includeToc,
  } = req.body as {
    projectId: string
    viewpoints?: string[]
    paperIds?: string[]
    sectionConfig?: SectionConfig[]
    citationFormat?: CitationFormat
    language?: 'en' | 'zh'
    totalWordCount?: number
    paperType?: PaperType
    includeToc?: boolean
  }

  if (!projectId) {
    res.status(400).json({ success: false, error: 'projectId is required' })
    return
  }

  const project = await projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }

  try {
    const format: CitationFormat = citationFormat || 'gbt'
    const lang: 'en' | 'zh' = language || 'zh'
    const wordCount = totalWordCount || 5000
    const pType: PaperType = paperType || 'graduation'
    const toc = includeToc !== undefined ? includeToc : true

    let config = sectionConfig && sectionConfig.length > 0
      ? sectionConfig
      : await projectService.getSectionConfig(projectId)
    if (config.length === 0) {
      config = DEFAULT_SECTIONS
    }
    await projectService.setSectionConfig(projectId, config)

    let papersToUse = await projectService.getSelectedPapers(projectId)
    if (papersToUse.length === 0) {
      papersToUse = await projectService.getPapers(projectId)
    }
    if (paperIds && paperIds.length > 0) {
      const allPapers = await projectService.getPapers(projectId)
      papersToUse = allPapers.filter(p => paperIds.includes(p.id))
    }

    let viewpointsToUse = viewpoints || await projectService.getViewpoints(projectId)
    if (viewpointsToUse.length === 0) {
      const stepData = await projectService.getStepData(projectId, 'extract')
      if (stepData && typeof stepData === 'object' && stepData !== null && 'viewpoints' in stepData) {
        viewpointsToUse = (stepData as { viewpoints: string[] }).viewpoints
      }
    }

    if (papersToUse.length === 0) {
      res.status(400).json({ success: false, error: 'No papers available for writing' })
      return
    }

    await projectService.setProgress(projectId, { stage: 'writing', progress: 50, message: '正在撰写论文...' })
    await projectService.updateProjectStatus(projectId, 'generating')

    const generatedSections = await writingAgent.execute(
      viewpointsToUse, project.topic, format, papersToUse, config, lang,
      (sectionTitle, _sectionIndex, totalSections, completedCount) => {
        const sectionProgress = 50 + Math.floor((completedCount / totalSections) * 15)
        projectService.setProgress(projectId, {
          stage: 'writing', progress: sectionProgress,
          message: `正在撰写：${sectionTitle}（${completedCount}/${totalSections}）`,
        })
      },
      wordCount, pType
    )
    await projectService.setGeneratedSections(projectId, generatedSections.map(s => ({ ...s, projectId })))

    await projectService.setProgress(projectId, { stage: 'citing', progress: 70, message: '正在格式化引用...' })
    const citeResult = await citationAgent.execute(generatedSections, papersToUse, format)
    await projectService.setGeneratedSections(projectId, citeResult.sections.map(s => ({ ...s, projectId })))
    await projectService.setReferences(projectId, citeResult.references)

    await projectService.setProgress(projectId, { stage: 'integrity_reviewing', progress: 79, message: '正在审核完整性...' })
    const integrityReport = await integrityAgent.execute(citeResult.sections, papersToUse, citeResult.references)

    let aigcPatternCount = 0
    try {
      const { detectAigcPatterns } = await import('../agents/aigcReductionAgent.js')
      for (const section of citeResult.sections) {
        const patterns = detectAigcPatterns(section.content)
        aigcPatternCount += patterns.reduce((sum, p) => sum + p.count, 0)
      }
    } catch { /* ignore */ }

    await projectService.setProgress(projectId, { stage: 'charting', progress: 86, message: '正在生成图表...' })
    const charts = await chartAgent.execute(citeResult.sections, papersToUse, project.topic)
    const sortedSections = [...citeResult.sections].sort((a, b) => a.order - b.order)
    const sectionIndexMap = new Map(sortedSections.map((s, i) => [s.order, i]))
    const updatedCharts = charts.map(c => {
      const idx = sectionIndexMap.get(c.position)
      return idx !== undefined ? { ...c, position: idx } : c
    })
    const updatedSections = citeResult.sections.map(s => {
      const idx = sectionIndexMap.get(s.order)
      return { ...s, charts: idx === undefined ? [] : updatedCharts.filter(c => c.position === idx) }
    })
    await projectService.setGeneratedSections(projectId, updatedSections.map(s => ({ ...s, projectId })))

    await projectService.setProgress(projectId, { stage: 'formatting', progress: 92, message: '正在排版...' })
    const formatResult = await formatAgent.execute(updatedSections, citeResult.references, toc)

    await projectService.setStepData(projectId, 'write', {
      sections: updatedSections,
      references: citeResult.references,
      integrityReport,
      aigcPatternCount,
      formattedContent: formatResult.content,
    })

    await projectService.setProgress(projectId, {
      stage: 'formatting', progress: 100,
      message: '论文撰写完成',
      partialContent: formatResult.content,
    })
    await projectService.updateProjectStatus(projectId, 'completed')

    res.json({
      success: true,
      data: {
        sections: updatedSections,
        references: citeResult.references,
        integrityReport,
        aigcPatternCount,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[StepWrite] Error:', msg)
    await projectService.updateProjectStatus(projectId, 'draft')
    res.status(500).json({ success: false, error: msg })
  }
})

router.post('/confirm', async (req: Request, res: Response): Promise<void> => {
  const { projectId, step, data } = req.body as {
    projectId: string
    step: number
    data?: Record<string, unknown>
  }

  if (!projectId || !step) {
    res.status(400).json({ success: false, error: 'projectId and step are required' })
    return
  }

  const stepNames = ['keywords', 'search', 'extract', 'outline', 'write', 'complete']
  const stepName = stepNames[step - 1]
  if (!stepName) {
    res.status(400).json({ success: false, error: 'Invalid step number' })
    return
  }

  if (data) {
    await projectService.setStepData(projectId, stepName, data)
  }

  if (step === 1 && data?.keywords) {
    await projectService.setKeywords(projectId, data.keywords as string[])
  }
  if (step === 1 && data?.sectionConfig) {
    await projectService.setSectionConfig(projectId, data.sectionConfig as SectionConfig[])
  }
  if (step === 2 && data?.selectedPaperIds) {
    await projectService.selectPapersByIds(projectId, data.selectedPaperIds as string[])
  }
  if (step === 3 && data?.viewpoints) {
    await projectService.setViewpoints(projectId, data.viewpoints as string[])
  }

  res.json({ success: true })
})

router.post('/rollback', async (req: Request, res: Response): Promise<void> => {
  const { projectId, step } = req.body as { projectId: string; step: number }

  if (!projectId || !step) {
    res.status(400).json({ success: false, error: 'projectId and step are required' })
    return
  }

  await projectService.clearStepDataAfter(projectId, step)

  const clearedSteps = []
  const stepNames = ['keywords', 'search', 'extract', 'outline', 'write', 'complete']
  for (let i = step; i < stepNames.length; i++) {
    clearedSteps.push(i + 1)
  }

  res.json({ success: true, clearedSteps })
})

export default router

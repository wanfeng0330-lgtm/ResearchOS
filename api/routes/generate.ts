import { Router, type Request, type Response } from 'express'
import * as projectService from '../services/projectService.js'
import * as orchestrator from '../agents/orchestrator.js'
import * as sectionPlanner from '../agents/sectionPlanner.js'
import { DEFAULT_SECTIONS } from '../../shared/types.js'
import type { CitationFormat, SectionConfig, PaperType } from '../../shared/types.js'

const router = Router()

router.post('/related-work', async (req: Request, res: Response): Promise<void> => {
  const { projectId, citationFormat, sectionConfig, autoSelectPapers, paperIds, description, language, includeToc, totalWordCount, paperType } = req.body as {
    projectId: string
    citationFormat?: CitationFormat
    sectionConfig?: SectionConfig[]
    autoSelectPapers?: boolean
    paperIds?: string[]
    description?: string
    language?: 'en' | 'zh'
    includeToc?: boolean
    totalWordCount?: number
    paperType?: PaperType
  }

  if (!projectId) {
    res.status(400).json({ success: false, error: 'projectId is required' })
    return
  }

  const project = projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }

  if (paperIds && paperIds.length > 0) {
    projectService.selectPapersByIds(projectId, paperIds)
  }

  const format: CitationFormat = citationFormat || 'gbt'
  const config: SectionConfig[] = sectionConfig && sectionConfig.length > 0 ? sectionConfig : DEFAULT_SECTIONS
  const autoSelect = autoSelectPapers !== undefined ? autoSelectPapers : true
  const desc = description || project.description || ''
  const lang: 'en' | 'zh' = language || 'en'
  const toc = includeToc !== undefined ? includeToc : true
  const wordCount = totalWordCount || 5000
  const pType: PaperType = paperType || 'graduation'

  projectService.setSectionConfig(projectId, config)

  orchestrator
    .orchestrate(projectId, project.topic, desc, format, config, autoSelect, lang, toc, wordCount, pType)
    .then(() => {
      console.log(`[Generate] Orchestration completed for project ${projectId}`)
    })
    .catch((error) => {
      console.error(`[Generate] Orchestration failed for project ${projectId}:`, error instanceof Error ? error.message : error)
    })

  res.json({
    success: true,
    data: { message: 'Generation started', projectId },
  })
})

router.get('/progress/:projectId', (req: Request, res: Response): void => {
  const progress = projectService.getProgress(req.params.projectId)
  const project = projectService.getProject(req.params.projectId)
  const papers = projectService.getPapers(req.params.projectId)

  res.json({
    success: true,
    data: {
      ...(progress || { stage: null, progress: 0, message: '' }),
      status: project?.status || 'draft',
      papers: papers.length > 0 ? papers : undefined,
    },
  })
})

router.post('/plan-sections', async (req: Request, res: Response): Promise<void> => {
  const { topic, description, totalWordCount, language } = req.body as {
    topic: string
    description?: string
    totalWordCount?: number
    language?: 'en' | 'zh'
  }

  if (!topic) {
    res.status(400).json({ success: false, error: 'topic is required' })
    return
  }

  const lang: 'en' | 'zh' = language || 'en'
  const words = totalWordCount || 5000
  const desc = description || topic

  try {
    const sections = await sectionPlanner.execute(topic, desc, words, lang)
    res.json({ success: true, data: sections })
  } catch (error) {
    console.error('[Generate] Section planning failed:', error)
    const fallback = [
      { type: 'introduction', title: lang === 'zh' ? '引言' : 'Introduction', enabled: true, wordCount: Math.round(words * 0.15), order: 0 },
      { type: 'related_work', title: lang === 'zh' ? '相关工作' : 'Related Work', enabled: true, wordCount: Math.round(words * 0.25), order: 1 },
      { type: 'methodology', title: lang === 'zh' ? '研究方法' : 'Methodology', enabled: true, wordCount: Math.round(words * 0.25), order: 2 },
      { type: 'experiments', title: lang === 'zh' ? '实验结果' : 'Experiments', enabled: true, wordCount: Math.round(words * 0.2), order: 3 },
      { type: 'conclusion', title: lang === 'zh' ? '结论' : 'Conclusion', enabled: true, wordCount: Math.round(words * 0.15), order: 4 },
    ]
    res.json({ success: true, data: fallback })
  }
})

export default router

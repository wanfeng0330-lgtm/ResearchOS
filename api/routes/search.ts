import { Router, type Request, type Response } from 'express'
import * as searchService from '../services/searchService.js'
import * as projectService from '../services/projectService.js'

const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { query, sources, maxResults } = req.body
  if (!query) {
    res.status(400).json({ success: false, error: 'Query is required' })
    return
  }
  try {
    const papers = await searchService.searchAll(
      query,
      sources || ['arxiv', 'semantic_scholar', 'crossref'],
      maxResults || 40
    )
    res.json({ success: true, data: papers })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    })
  }
})

router.post('/select', async (req: Request, res: Response): Promise<void> => {
  const { projectId, paperIds } = req.body
  if (!projectId || !Array.isArray(paperIds)) {
    res.status(400).json({ success: false, error: 'projectId and paperIds are required' })
    return
  }
  const project = await projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }
  await projectService.selectPapersByIds(projectId, paperIds)
  const papers = await projectService.getPapers(projectId)
  res.json({ success: true, data: papers })
})

export default router

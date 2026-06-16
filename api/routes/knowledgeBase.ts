import { Router, type Request, type Response } from 'express'
import * as knowledgeBaseService from '../services/knowledgeBaseService.js'

interface ProjectParams {
  projectId: string
}

interface EntryParams extends ProjectParams {
  entryId: string
}

const router = Router({ mergeParams: true })

router.get('/', async (req: Request<ProjectParams>, res: Response) => {
  const { projectId } = req.params
  const entries = await knowledgeBaseService.getEntries(projectId)
  res.json({ success: true, data: entries })
})

router.get('/viewpoints', async (req: Request<ProjectParams>, res: Response) => {
  const { projectId } = req.params
  const { sectionType } = req.query
  const viewpoints = sectionType
    ? await knowledgeBaseService.getViewpointsBySectionType(projectId, sectionType as string)
    : await knowledgeBaseService.getEntriesByType(projectId, 'viewpoint')
  res.json({ success: true, data: viewpoints })
})

router.post('/summarize', async (req: Request<ProjectParams>, res: Response) => {
  const { projectId } = req.params
  const { paperId } = req.body
  if (!paperId) {
    res.status(400).json({ success: false, error: 'paperId is required' })
    return
  }
  const existing = await knowledgeBaseService.getSummary(projectId, paperId)
  if (existing) {
    res.json({ success: true, data: existing })
    return
  }
  res.json({ success: true, data: null, message: 'Summary generation will be implemented in Phase 2' })
})

router.post('/notes', async (req: Request<ProjectParams>, res: Response) => {
  const { projectId } = req.params
  const { content, sourcePaperIds } = req.body
  if (!content?.trim()) {
    res.status(400).json({ success: false, error: 'Content is required' })
    return
  }
  const entry = await knowledgeBaseService.addNote(projectId, content.trim(), sourcePaperIds)
  res.status(201).json({ success: true, data: entry })
})

router.delete('/entries/:entryId', async (req: Request<EntryParams>, res: Response) => {
  const { projectId, entryId } = req.params
  const deleted = await knowledgeBaseService.deleteEntry(projectId, entryId)
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Entry not found' })
    return
  }
  res.json({ success: true, message: 'Entry deleted' })
})

export default router

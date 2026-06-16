import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import * as projectService from '../services/projectService.js'

const router = Router()

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const query = paginationQuerySchema.parse(req.query)
  const result = await projectService.getProjects(query)
  res.json({ success: true, data: result.data, pagination: result.pagination })
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { topic, title, description, language } = req.body
  if (!topic) {
    res.status(400).json({ success: false, error: 'Topic is required' })
    return
  }
  const project = await projectService.createProject(topic, title, description, language || 'en')
  res.status(201).json({ success: true, data: project })
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.getProject(req.params.id)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }
  const projectPapers = await projectService.getPapers(req.params.id)
  const projectSections = await projectService.getGeneratedSections(req.params.id)
  const projectReferences = await projectService.getReferences(req.params.id)
  const projectKeywords = await projectService.getKeywords(req.params.id)
  res.json({
    success: true,
    data: { ...project, papers: projectPapers, sections: projectSections, references: projectReferences, keywords: projectKeywords },
  })
})

export default router

import { Router, type Request, type Response } from 'express'
import * as projectService from '../services/projectService.js'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  const projects = projectService.getProjects()
  res.json({ success: true, data: projects })
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { topic, title, description, language } = req.body
  if (!topic) {
    res.status(400).json({ success: false, error: 'Topic is required' })
    return
  }
  const project = projectService.createProject(topic, title, description, language || 'en')
  res.status(201).json({ success: true, data: project })
})

router.get('/:id', (req: Request, res: Response): void => {
  const project = projectService.getProject(req.params.id)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }
  const projectPapers = projectService.getPapers(req.params.id)
  const projectSections = projectService.getGeneratedSections(req.params.id)
  const projectReferences = projectService.getReferences(req.params.id)
  const projectKeywords = projectService.getKeywords(req.params.id)
  res.json({
    success: true,
    data: { ...project, papers: projectPapers, sections: projectSections, references: projectReferences, keywords: projectKeywords },
  })
})

export default router

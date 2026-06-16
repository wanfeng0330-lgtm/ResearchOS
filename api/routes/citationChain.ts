import { Router, type Request, type Response } from 'express'
import * as citationChainService from '../services/citationChainService.js'

interface ProjectParams {
  projectId: string
}

interface LinkParams extends ProjectParams {
  linkId: string
}

const router = Router({ mergeParams: true })

router.get('/', async (req: Request<ProjectParams>, res: Response) => {
  const { projectId } = req.params
  const chain = await citationChainService.getChain(projectId)
  res.json({ success: true, data: chain })
})

router.post('/link', async (req: Request<ProjectParams>, res: Response) => {
  const { projectId } = req.params
  const { paperId, sectionId, context } = req.body
  if (!paperId || !sectionId) {
    res.status(400).json({ success: false, error: 'paperId and sectionId are required' })
    return
  }
  const link = await citationChainService.addLink(projectId, paperId, sectionId, context || '')
  res.status(201).json({ success: true, data: link })
})

router.delete('/link/:linkId', async (req: Request<LinkParams>, res: Response) => {
  const { projectId, linkId } = req.params
  const deleted = await citationChainService.removeLink(projectId, linkId)
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Link not found' })
    return
  }
  res.json({ success: true, message: 'Link deleted' })
})

export default router

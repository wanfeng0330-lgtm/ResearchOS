import { Router, type Request, type Response } from 'express'
import * as workflowEngine from '../services/workflowEngine.js'

interface ProjectParams {
  projectId: string
}

const router = Router({ mergeParams: true })

router.get('/', (req: Request<ProjectParams>, res: Response) => {
  const { projectId } = req.params
  const state = workflowEngine.getWorkflowState(projectId)
  if (!state) {
    res.json({ success: true, data: null, message: 'No workflow state found for this project' })
    return
  }
  res.json({ success: true, data: state })
})

router.post('/resume', (req: Request<ProjectParams>, res: Response) => {
  const { projectId } = req.params
  if (!workflowEngine.canResume(projectId)) {
    res.status(400).json({ success: false, error: 'Workflow cannot be resumed' })
    return
  }
  workflowEngine.resumeWorkflow(projectId)
  const state = workflowEngine.getWorkflowState(projectId)
  res.json({ success: true, data: state, message: 'Workflow resumed. Re-trigger generation to continue.' })
})

router.post('/cancel', (req: Request<ProjectParams>, res: Response) => {
  const { projectId } = req.params
  workflowEngine.cancelWorkflow(projectId)
  const state = workflowEngine.getWorkflowState(projectId)
  res.json({ success: true, data: state, message: 'Workflow cancelled' })
})

export default router

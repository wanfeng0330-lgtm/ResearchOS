import { Router } from 'express'
import * as workspaceService from '../services/workspaceService.js'
import * as projectService from '../services/projectService.js'

const router = Router()

router.get('/', (req, res) => {
  const workspaces = workspaceService.getWorkspaces()
  res.json({ success: true, data: workspaces })
})

router.post('/', (req, res) => {
  const { name, description, settings } = req.body
  if (!name?.trim()) {
    res.status(400).json({ success: false, error: 'Workspace name is required' })
    return
  }
  const workspace = workspaceService.createWorkspace(name.trim(), description, settings)
  res.status(201).json({ success: true, data: workspace })
})

router.get('/:id', (req, res) => {
  const workspace = workspaceService.getWorkspace(req.params.id)
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  res.json({ success: true, data: workspace })
})

router.put('/:id', (req, res) => {
  const { name, description, settings } = req.body
  const workspace = workspaceService.updateWorkspace(req.params.id, { name, description, settings })
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  res.json({ success: true, data: workspace })
})

router.delete('/:id', (req, res) => {
  const deleted = workspaceService.deleteWorkspace(req.params.id)
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  res.json({ success: true, message: 'Workspace deleted' })
})

router.get('/:id/projects', (req, res) => {
  const workspace = workspaceService.getWorkspace(req.params.id)
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  const projects = workspaceService.getWorkspaceProjects(req.params.id)
  res.json({ success: true, data: projects })
})

router.post('/:id/projects', (req, res) => {
  const { topic, title, description, language } = req.body
  if (!topic?.trim()) {
    res.status(400).json({ success: false, error: 'Topic is required' })
    return
  }
  const workspace = workspaceService.getWorkspace(req.params.id)
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  const project = projectService.createProject(
    topic.trim(),
    title,
    description,
    language || workspace.settings.defaultLanguage,
    req.params.id,
  )
  res.status(201).json({ success: true, data: project })
})

export default router

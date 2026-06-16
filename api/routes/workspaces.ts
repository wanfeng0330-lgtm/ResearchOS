import { Router } from 'express'
import { z } from 'zod'
import * as workspaceService from '../services/workspaceService.js'
import * as projectService from '../services/projectService.js'

const router = Router()

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

router.get('/', async (req, res) => {
  const query = paginationQuerySchema.parse(req.query)
  const result = await workspaceService.getWorkspaces(query)
  res.json({ success: true, data: result.data, pagination: result.pagination })
})

router.post('/', async (req, res) => {
  const { name, description, settings } = req.body
  if (!name?.trim()) {
    res.status(400).json({ success: false, error: 'Workspace name is required' })
    return
  }
  const workspace = await workspaceService.createWorkspace(name.trim(), description, settings)
  res.status(201).json({ success: true, data: workspace })
})

router.get('/:id', async (req, res) => {
  const workspace = await workspaceService.getWorkspace(req.params.id)
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  res.json({ success: true, data: workspace })
})

router.put('/:id', async (req, res) => {
  const { name, description, settings } = req.body
  const workspace = await workspaceService.updateWorkspace(req.params.id, { name, description, settings })
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  res.json({ success: true, data: workspace })
})

router.delete('/:id', async (req, res) => {
  const deleted = await workspaceService.deleteWorkspace(req.params.id)
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  res.json({ success: true, message: 'Workspace deleted' })
})

router.get('/:id/projects', async (req, res) => {
  const workspace = await workspaceService.getWorkspace(req.params.id)
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  const projects = await workspaceService.getWorkspaceProjects(req.params.id)
  res.json({ success: true, data: projects })
})

router.post('/:id/projects', async (req, res) => {
  const { topic, title, description, language } = req.body
  if (!topic?.trim()) {
    res.status(400).json({ success: false, error: 'Topic is required' })
    return
  }
  const workspace = await workspaceService.getWorkspace(req.params.id)
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  const project = await projectService.createProject(
    topic.trim(),
    title,
    description,
    language || workspace.settings.defaultLanguage,
    req.params.id,
  )
  res.status(201).json({ success: true, data: project })
})

export default router

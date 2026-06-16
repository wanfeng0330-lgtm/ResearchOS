import { v4 as uuidv4 } from 'uuid'
import type { Workspace, WorkspaceSettings, Project, PaginationParams, PaginatedResult } from '../../shared/types.js'
import * as projectService from './projectService.js'
import { workspaceRepo, projectRepo } from '../db/repository.js'

const DB_ENABLED = process.env.DB_ENABLED !== 'false'

const DEFAULT_SETTINGS: WorkspaceSettings = {
  defaultCitationFormat: 'gbt',
  defaultLanguage: 'zh',
  defaultPaperType: 'graduation',
}

// In-memory storage for fallback when DB is disabled
const workspaces = new Map<string, Workspace>()
const workspaceProjects = new Map<string, string[]>()

// Helper to convert DB result to Workspace type (Date -> ISO string)
function toWorkspace(row: {
  id: string
  name: string
  description: string | null
  settings: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}): Workspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    settings: { ...DEFAULT_SETTINGS, ...((row.settings || {}) as unknown as WorkspaceSettings) },
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  }
}

export async function createWorkspace(name: string, description?: string, settings?: Partial<WorkspaceSettings>): Promise<Workspace> {
  if (DB_ENABLED) {
    const row = await workspaceRepo.create({
      name,
      description: description || '',
      settings: { ...DEFAULT_SETTINGS, ...settings },
    })
    return toWorkspace(row)
  }

  // In-memory fallback
  const id = uuidv4()
  const now = new Date().toISOString()
  const workspace: Workspace = {
    id,
    name,
    description: description || '',
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SETTINGS, ...settings },
  }
  workspaces.set(id, workspace)
  workspaceProjects.set(id, [])
  return workspace
}

export async function getWorkspaces(pagination?: PaginationParams): Promise<PaginatedResult<Workspace>> {
  const page = pagination?.page ?? 1
  const limit = pagination?.limit ?? 20
  const offset = (page - 1) * limit

  if (DB_ENABLED) {
    const { rows, total } = await workspaceRepo.findAllPaginated(limit, offset)
    return {
      data: rows.map(toWorkspace),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  // In-memory fallback
  const all = Array.from(workspaces.values())
  const total = all.length
  return {
    data: all.slice(offset, offset + limit),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  if (DB_ENABLED) {
    const row = await workspaceRepo.findById(id)
    return row ? toWorkspace(row) : null
  }

  // In-memory fallback
  return workspaces.get(id) || null
}

export async function updateWorkspace(id: string, updates: Partial<Pick<Workspace, 'name' | 'description' | 'settings'>>): Promise<Workspace | null> {
  if (DB_ENABLED) {
    const row = await workspaceRepo.update(id, {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.settings !== undefined ? { settings: updates.settings as unknown as Record<string, unknown> } : {}),
    })
    return row ? toWorkspace(row) : null
  }

  // In-memory fallback
  const workspace = workspaces.get(id)
  if (!workspace) return null
  if (updates.name !== undefined) workspace.name = updates.name
  if (updates.description !== undefined) workspace.description = updates.description
  if (updates.settings !== undefined) workspace.settings = { ...workspace.settings, ...updates.settings }
  workspace.updatedAt = new Date().toISOString()
  return workspace
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  if (DB_ENABLED) {
    // Update projects in this workspace to draft status and remove workspace association
    const projects = await projectRepo.findByWorkspace(id)
    for (const project of projects) {
      await projectRepo.updateStatus(project.id, 'draft')
    }
    return await workspaceRepo.delete(id)
  }

  // In-memory fallback
  const projectIds = workspaceProjects.get(id) || []
  for (const projectId of projectIds) {
    await projectService.updateProjectStatus(projectId, 'draft')
  }
  workspaceProjects.delete(id)
  return workspaces.delete(id)
}

export async function getWorkspaceProjects(workspaceId: string): Promise<Project[]> {
  if (DB_ENABLED) {
    const rows = await projectRepo.findByWorkspace(workspaceId)
    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId || undefined,
      title: row.title,
      topic: row.topic,
      description: row.description || '',
      status: row.status as Project['status'],
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      language: (row.language as 'en' | 'zh') || 'en',
      keywords: row.keywords || [],
    }))
  }

  // In-memory fallback
  const projectIds = workspaceProjects.get(workspaceId) || []
  const projects: Project[] = []
  for (const pid of projectIds) {
    const p = await projectService.getProject(pid)
    if (p !== null) projects.push(p)
  }
  return projects
}

export async function addProjectToWorkspace(workspaceId: string, projectId: string): Promise<boolean> {
  if (DB_ENABLED) {
    const workspace = await workspaceRepo.findById(workspaceId)
    if (!workspace) return false
    // In DB mode, the project already has workspaceId set when created
    // Just touch the workspace to update updatedAt
    await workspaceRepo.update(workspaceId, {})
    return true
  }

  // In-memory fallback
  const ids = workspaceProjects.get(workspaceId)
  if (!ids) return false
  if (!ids.includes(projectId)) {
    ids.push(projectId)
  }
  const workspace = workspaces.get(workspaceId)
  if (workspace) workspace.updatedAt = new Date().toISOString()
  return true
}

export async function removeProjectFromWorkspace(workspaceId: string, projectId: string): Promise<boolean> {
  if (DB_ENABLED) {
    const workspace = await workspaceRepo.findById(workspaceId)
    if (!workspace) return false
    // In DB mode, just touch the workspace to update updatedAt
    await workspaceRepo.update(workspaceId, {})
    return true
  }

  // In-memory fallback
  const ids = workspaceProjects.get(workspaceId)
  if (!ids) return false
  const index = ids.indexOf(projectId)
  if (index >= 0) ids.splice(index, 1)
  const workspace = workspaces.get(workspaceId)
  if (workspace) workspace.updatedAt = new Date().toISOString()
  return true
}

export async function createDefaultWorkspace(): Promise<Workspace> {
  if (DB_ENABLED) {
    const { data: existing } = await getWorkspaces()
    if (existing.length > 0) return existing[0]
    return await createWorkspace('默认工作台', '我的科研工作台')
  }

  // In-memory fallback
  const { data: existing } = await getWorkspaces()
  if (existing.length > 0) return existing[0]
  return await createWorkspace('默认工作台', '我的科研工作台')
}
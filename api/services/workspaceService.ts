import { v4 as uuidv4 } from 'uuid'
import type { Workspace, WorkspaceSettings, Project } from '../../shared/types.js'
import * as projectService from './projectService.js'

const workspaces = new Map<string, Workspace>()
const workspaceProjects = new Map<string, string[]>()

const DEFAULT_SETTINGS: WorkspaceSettings = {
  defaultCitationFormat: 'gbt',
  defaultLanguage: 'zh',
  defaultPaperType: 'graduation',
}

export function createWorkspace(name: string, description?: string, settings?: Partial<WorkspaceSettings>): Workspace {
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

export function getWorkspaces(): Workspace[] {
  return Array.from(workspaces.values())
}

export function getWorkspace(id: string): Workspace | null {
  return workspaces.get(id) || null
}

export function updateWorkspace(id: string, updates: Partial<Pick<Workspace, 'name' | 'description' | 'settings'>>): Workspace | null {
  const workspace = workspaces.get(id)
  if (!workspace) return null
  if (updates.name !== undefined) workspace.name = updates.name
  if (updates.description !== undefined) workspace.description = updates.description
  if (updates.settings !== undefined) workspace.settings = { ...workspace.settings, ...updates.settings }
  workspace.updatedAt = new Date().toISOString()
  return workspace
}

export function deleteWorkspace(id: string): boolean {
  const projectIds = workspaceProjects.get(id) || []
  for (const projectId of projectIds) {
    projectService.updateProjectStatus(projectId, 'draft')
  }
  workspaceProjects.delete(id)
  return workspaces.delete(id)
}

export function getWorkspaceProjects(workspaceId: string): Project[] {
  const projectIds = workspaceProjects.get(workspaceId) || []
  return projectIds
    .map(pid => projectService.getProject(pid))
    .filter((p): p is Project => p !== null)
}

export function addProjectToWorkspace(workspaceId: string, projectId: string): boolean {
  const ids = workspaceProjects.get(workspaceId)
  if (!ids) return false
  if (!ids.includes(projectId)) {
    ids.push(projectId)
  }
  const workspace = workspaces.get(workspaceId)
  if (workspace) workspace.updatedAt = new Date().toISOString()
  return true
}

export function removeProjectFromWorkspace(workspaceId: string, projectId: string): boolean {
  const ids = workspaceProjects.get(workspaceId)
  if (!ids) return false
  const index = ids.indexOf(projectId)
  if (index >= 0) ids.splice(index, 1)
  const workspace = workspaces.get(workspaceId)
  if (workspace) workspace.updatedAt = new Date().toISOString()
  return true
}

export function createDefaultWorkspace(): Workspace {
  const existing = getWorkspaces()
  if (existing.length > 0) return existing[0]
  return createWorkspace('默认工作台', '我的科研工作台')
}

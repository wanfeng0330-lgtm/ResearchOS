import { v4 as uuidv4 } from 'uuid'
import type { Project, Paper, GeneratedSection, ExportJob, GenerationProgress, SectionConfig, Reference } from '../../shared/types.js'
let _addProjectToWorkspace: ((workspaceId: string, projectId: string) => boolean) | null = null

export function setWorkspaceLinker(fn: (workspaceId: string, projectId: string) => boolean): void {
  _addProjectToWorkspace = fn
}

const projects = new Map<string, Project>()
const papers = new Map<string, Paper[]>()
const sections = new Map<string, GeneratedSection[]>()
const exportJobs = new Map<string, ExportJob>()
const progressMap = new Map<string, GenerationProgress>()
const sectionConfigMap = new Map<string, SectionConfig[]>()
const referencesMap = new Map<string, Reference[]>()
const keywordsMap = new Map<string, string[]>()

export function createProject(topic: string, title?: string, description?: string, language: 'en' | 'zh' = 'en', workspaceId?: string): Project {
  const id = uuidv4()
  const now = new Date().toISOString()
  const project: Project = {
    id,
    title: title || topic,
    topic,
    description: description || '',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    language,
    ...(workspaceId ? { workspaceId } : {}),
  }
  projects.set(id, project)
  papers.set(id, [])
  sections.set(id, [])
  if (workspaceId) {
    _addProjectToWorkspace?.(workspaceId, id)
  }
  return project
}

export function getProjects(): Project[] {
  return Array.from(projects.values())
}

export function getProject(id: string): Project | null {
  return projects.get(id) || null
}

export function updateProjectStatus(id: string, status: Project['status']): void {
  const project = projects.get(id)
  if (project) {
    project.status = status
    project.updatedAt = new Date().toISOString()
  }
}

export function setKeywords(projectId: string, keywords: string[]): void {
  keywordsMap.set(projectId, keywords)
  const project = projects.get(projectId)
  if (project) {
    project.keywords = keywords
    project.updatedAt = new Date().toISOString()
  }
}

export function getKeywords(projectId: string): string[] {
  return keywordsMap.get(projectId) || []
}

export function addPapers(projectId: string, newPapers: Paper[]): void {
  const existing = papers.get(projectId) || []
  const existingIds = new Set(existing.map((p) => p.sourceId))
  const unique = newPapers.filter((p) => !existingIds.has(p.sourceId))
  const mapped = unique.map((p) => ({ ...p, projectId }))
  papers.set(projectId, [...existing, ...mapped])
}

export function getPapers(projectId: string): Paper[] {
  return papers.get(projectId) || []
}

export function togglePaperSelection(projectId: string, paperId: string): void {
  const list = papers.get(projectId)
  if (!list) return
  const paper = list.find((p) => p.id === paperId)
  if (paper) paper.selected = !paper.selected
}

export function selectPapersByIds(projectId: string, paperIds: string[]): void {
  const list = papers.get(projectId)
  if (!list) return
  for (const paper of list) {
    paper.selected = paperIds.includes(paper.id)
  }
}

export function getSelectedPapers(projectId: string): Paper[] {
  return (papers.get(projectId) || []).filter((p) => p.selected)
}

export function setGeneratedSections(projectId: string, newSections: GeneratedSection[]): void {
  sections.set(projectId, newSections)
}

export function getGeneratedSections(projectId: string): GeneratedSection[] {
  return sections.get(projectId) || []
}

export function setSectionConfig(projectId: string, config: SectionConfig[]): void {
  sectionConfigMap.set(projectId, config)
}

export function getSectionConfig(projectId: string): SectionConfig[] {
  return sectionConfigMap.get(projectId) || []
}

export function setReferences(projectId: string, refs: Reference[]): void {
  referencesMap.set(projectId, refs)
}

export function getReferences(projectId: string): Reference[] {
  return referencesMap.get(projectId) || []
}

export function createExportJob(
  projectId: string,
  format: ExportJob['format'],
  citationFormat: ExportJob['citationFormat']
): ExportJob {
  const id = uuidv4()
  const job: ExportJob = {
    id,
    projectId,
    format,
    citationFormat,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  exportJobs.set(id, job)
  return job
}

export function updateExportJob(id: string, updates: Partial<ExportJob>): void {
  const job = exportJobs.get(id)
  if (job) Object.assign(job, updates)
}

export function getExportJob(id: string): ExportJob | null {
  return exportJobs.get(id) || null
}

export function setProgress(projectId: string, progress: GenerationProgress): void {
  progressMap.set(projectId, progress)
}

export function getProgress(projectId: string): GenerationProgress | null {
  return progressMap.get(projectId) || null
}

const stepDataMap = new Map<string, Map<string, unknown>>()

export function setStepData(projectId: string, step: string, data: unknown): void {
  if (!stepDataMap.has(projectId)) {
    stepDataMap.set(projectId, new Map())
  }
  stepDataMap.get(projectId)!.set(step, data)
}

export function getStepData(projectId: string, step: string): unknown | null {
  return stepDataMap.get(projectId)?.get(step) || null
}

export function clearStepDataAfter(projectId: string, afterStep: number): void {
  const stepNames = ['keywords', 'search', 'extract', 'outline', 'write', 'complete']
  for (let i = afterStep; i < stepNames.length; i++) {
    stepDataMap.get(projectId)?.delete(stepNames[i])
  }
  if (afterStep <= 4) {
    sections.set(projectId, [])
    referencesMap.set(projectId, [])
  }
  if (afterStep <= 3) {
    progressMap.set(projectId, { stage: 'keyword_extracting', progress: 0, message: '' })
  }
  if (afterStep <= 2) {
    keywordsMap.set(projectId, [])
  }
  if (afterStep <= 1) {
    papers.set(projectId, [])
  }
}

export function getViewpoints(projectId: string): string[] {
  const data = stepDataMap.get(projectId)?.get('extract')
  if (data && typeof data === 'object' && data !== null && 'viewpoints' in data) {
    return (data as { viewpoints: string[] }).viewpoints
  }
  return []
}

export function setViewpoints(projectId: string, viewpoints: string[]): void {
  const existing = (stepDataMap.get(projectId)?.get('extract') || {}) as Record<string, unknown>
  setStepData(projectId, 'extract', { ...existing, viewpoints })
}

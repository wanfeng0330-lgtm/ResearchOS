import { v4 as uuidv4 } from 'uuid'
import type { Project, Paper, GeneratedSection, ExportJob, GenerationProgress, SectionConfig, Reference, PaginationParams, PaginatedResult } from '../../shared/types.js'
import { SUPABASE_ENABLED } from '../db/supabaseClient.js'
import {
  projectRepo,
  paperRepo,
  sectionRepo,
  referenceRepo,
  exportJobRepo,
} from '../db/supabaseRepository.js'

let _addProjectToWorkspace: ((workspaceId: string, projectId: string) => boolean | Promise<boolean>) | null = null

export function setWorkspaceLinker(fn: (workspaceId: string, projectId: string) => boolean | Promise<boolean>): void {
  _addProjectToWorkspace = fn
}

// In-memory fallback storage (used when DB is disabled)
const projects = new Map<string, Project>()
const papers = new Map<string, Paper[]>()
const sections = new Map<string, GeneratedSection[]>()
const exportJobs = new Map<string, ExportJob>()
const progressMap = new Map<string, GenerationProgress>()
const sectionConfigMap = new Map<string, SectionConfig[]>()
const referencesMap = new Map<string, Reference[]>()
const keywordsMap = new Map<string, string[]>()

// Helper to convert DB project result to shared Project type
function dbProjectToModel(row: any): Project {
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    description: row.description ?? '',
    status: row.status,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    language: row.language,
    workspaceId: row.workspaceId ?? undefined,
    keywords: row.keywords ?? undefined,
    totalWordCount: row.totalWordCount ?? undefined,
  }
}

// Helper to convert DB paper result to shared Paper type
function dbPaperToModel(row: any): Paper {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    authors: row.authors ?? [],
    year: row.year ?? 0,
    abstract: row.abstract ?? '',
    source: row.source,
    sourceId: row.sourceId ?? '',
    pdfUrl: row.pdfUrl ?? undefined,
    citationCount: row.citationCount ?? undefined,
    keywords: row.keywords ?? undefined,
    bibtex: row.bibtex ?? undefined,
    doi: row.doi ?? undefined,
    selected: row.selected ?? false,
    relevanceScore: row.relevanceScore ?? undefined,
    journal: row.journal ?? undefined,
  }
}

// Helper to convert DB section result to shared GeneratedSection type
function dbSectionToModel(row: any): GeneratedSection {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    title: row.title,
    content: row.content,
    citations: row.citations ?? [],
    order: row.sectionOrder,
    wordCount: row.wordCount ?? undefined,
    charts: row.charts ?? undefined,
  }
}

// Helper to convert DB reference result to shared Reference type
function dbReferenceToModel(row: any): Reference {
  return {
    id: row.id,
    paperId: row.paperId ?? '',
    authors: '', // Not stored in DB, would need to be derived
    title: '',   // Not stored in DB, would need to be derived
    year: 0,     // Not stored in DB, would need to be derived
    bibtex: row.bibtex ?? '',
    apa: row.apa ?? '',
    ieee: row.ieee ?? '',
    gbt: row.gbt ?? '',
  }
}

// Helper to convert DB export job result to shared ExportJob type
function dbExportJobToModel(row: any): ExportJob {
  return {
    id: row.id,
    projectId: row.projectId,
    format: row.format,
    citationFormat: row.citationFormat,
    status: row.status,
    fileName: row.filePath ?? undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  }
}

// ==================== Project Functions ====================

export async function createProject(
  topic: string,
  title?: string,
  description?: string,
  language: 'en' | 'zh' = 'en',
  workspaceId?: string
): Promise<Project> {
  if (SUPABASE_ENABLED) {
    const result = await projectRepo.create({
      title: title || topic,
      topic,
      description: description || '',
      language,
      workspaceId,
    })
    if (workspaceId) {
      await _addProjectToWorkspace?.(workspaceId, result.id)
    }
    return dbProjectToModel(result)
  }

  // In-memory fallback
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
    await _addProjectToWorkspace?.(workspaceId, id)
  }
  return project
}

export async function getProjects(pagination?: PaginationParams): Promise<PaginatedResult<Project>> {
  const page = pagination?.page ?? 1
  const limit = pagination?.limit ?? 20
  const offset = (page - 1) * limit

  if (SUPABASE_ENABLED) {
    const { rows, total } = await projectRepo.findAllPaginated(limit, offset)
    return {
      data: rows.map(dbProjectToModel),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  const all = Array.from(projects.values())
  const total = all.length
  return {
    data: all.slice(offset, offset + limit),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

export async function getProject(id: string): Promise<Project | null> {
  if (SUPABASE_ENABLED) {
    const result = await projectRepo.findById(id)
    return result ? dbProjectToModel(result) : null
  }
  return projects.get(id) || null
}

export async function updateProjectStatus(id: string, status: Project['status']): Promise<void> {
  if (SUPABASE_ENABLED) {
    await projectRepo.updateStatus(id, status)
    return
  }
  const project = projects.get(id)
  if (project) {
    project.status = status
    project.updatedAt = new Date().toISOString()
  }
}

export async function updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<Project | null> {
  if (SUPABASE_ENABLED) {
    const updateData: Record<string, any> = { ...updates, updatedAt: new Date() }
    const [result] = await db.update(schema.projects)
      .set(updateData)
      .where(eq(schema.projects.id, id))
      .returning()
    return result ? dbProjectToModel(result) : null
  }
  const project = projects.get(id)
  if (!project) return null
  Object.assign(project, updates, { updatedAt: new Date().toISOString() })
  return project
}

// ==================== Keywords Functions ====================

export async function setKeywords(projectId: string, keywords: string[]): Promise<void> {
  if (SUPABASE_ENABLED) {
    await projectRepo.updateKeywords(projectId, keywords)
    return
  }
  keywordsMap.set(projectId, keywords)
  const project = projects.get(projectId)
  if (project) {
    project.keywords = keywords
    project.updatedAt = new Date().toISOString()
  }
}

export async function getKeywords(projectId: string): Promise<string[]> {
  if (SUPABASE_ENABLED) {
    const project = await projectRepo.findById(projectId)
    return project?.keywords ?? []
  }
  return keywordsMap.get(projectId) || []
}

// ==================== Papers Functions ====================

export async function addPapers(projectId: string, newPapers: Paper[]): Promise<void> {
  if (SUPABASE_ENABLED) {
    for (const paper of newPapers) {
      await paperRepo.create({
        projectId,
        title: paper.title,
        source: paper.source,
        authors: paper.authors,
        year: paper.year,
        abstract: paper.abstract,
        sourceId: paper.sourceId,
        pdfUrl: paper.pdfUrl,
        citationCount: paper.citationCount,
        keywords: paper.keywords,
        bibtex: paper.bibtex,
        doi: paper.doi,
        journal: paper.journal,
        selected: paper.selected,
        relevanceScore: paper.relevanceScore,
      })
    }
    return
  }

  // In-memory fallback
  const existing = papers.get(projectId) || []
  const existingIds = new Set(existing.map((p) => p.sourceId))
  const unique = newPapers.filter((p) => !existingIds.has(p.sourceId))
  const mapped = unique.map((p) => ({ ...p, projectId }))
  papers.set(projectId, [...existing, ...mapped])
}

export async function getPapers(projectId: string): Promise<Paper[]> {
  if (SUPABASE_ENABLED) {
    const results = await paperRepo.findByProject(projectId)
    return results.map(dbPaperToModel)
  }
  return papers.get(projectId) || []
}

export async function togglePaperSelection(projectId: string, paperId: string): Promise<void> {
  if (SUPABASE_ENABLED) {
    const results = await paperRepo.findByProject(projectId)
    const paper = results.find((p) => p.id === paperId)
    if (paper) {
      await paperRepo.updateSelection(paperId, !paper.selected)
    }
    return
  }
  const list = papers.get(projectId)
  if (!list) return
  const paper = list.find((p) => p.id === paperId)
  if (paper) paper.selected = !paper.selected
}

export async function selectPapersByIds(projectId: string, paperIds: string[]): Promise<void> {
  if (SUPABASE_ENABLED) {
    const results = await paperRepo.findByProject(projectId)
    for (const paper of results) {
      const selected = paperIds.includes(paper.id)
      if (paper.selected !== selected) {
        await paperRepo.updateSelection(paper.id, selected)
      }
    }
    return
  }
  const list = papers.get(projectId)
  if (!list) return
  for (const paper of list) {
    paper.selected = paperIds.includes(paper.id)
  }
}

export async function getSelectedPapers(projectId: string): Promise<Paper[]> {
  if (SUPABASE_ENABLED) {
    const results = await paperRepo.findSelected(projectId)
    return results.map(dbPaperToModel)
  }
  return (papers.get(projectId) || []).filter((p) => p.selected)
}

// ==================== Sections Functions ====================

export async function setGeneratedSections(projectId: string, newSections: GeneratedSection[]): Promise<void> {
  if (SUPABASE_ENABLED) {
    await sectionRepo.replaceAll(projectId, newSections.map((s, i) => ({
      type: s.type,
      title: s.title,
      content: s.content,
      sectionOrder: s.order ?? i,
      citations: s.citations,
      wordCount: s.wordCount,
      charts: s.charts,
    })))
    return
  }
  sections.set(projectId, newSections)
}

export async function getGeneratedSections(projectId: string): Promise<GeneratedSection[]> {
  if (SUPABASE_ENABLED) {
    const results = await sectionRepo.findByProject(projectId)
    return results.map(dbSectionToModel)
  }
  return sections.get(projectId) || []
}

// ==================== Section Config Functions ====================
// Section config is kept in-memory as it's transient wizard state

export async function setSectionConfig(projectId: string, config: SectionConfig[]): Promise<void> {
  sectionConfigMap.set(projectId, config)
}

export async function getSectionConfig(projectId: string): Promise<SectionConfig[]> {
  return sectionConfigMap.get(projectId) || []
}

// ==================== References Functions ====================

export async function setReferences(projectId: string, refs: Reference[]): Promise<void> {
  if (SUPABASE_ENABLED) {
    await referenceRepo.replaceAll(projectId, refs.map((r) => ({
      paperId: r.paperId || undefined,
      bibtex: r.bibtex,
      apa: r.apa,
      ieee: r.ieee,
      gbt: r.gbt,
    })))
    return
  }
  referencesMap.set(projectId, refs)
}

export async function getReferences(projectId: string): Promise<Reference[]> {
  if (SUPABASE_ENABLED) {
    const results = await referenceRepo.findByProject(projectId)
    return results.map(dbReferenceToModel)
  }
  return referencesMap.get(projectId) || []
}

// ==================== Export Job Functions ====================

export async function createExportJob(
  projectId: string,
  format: ExportJob['format'],
  citationFormat: ExportJob['citationFormat']
): Promise<ExportJob> {
  if (SUPABASE_ENABLED) {
    const result = await exportJobRepo.create({
      projectId,
      format,
      citationFormat,
    })
    return dbExportJobToModel(result)
  }

  // In-memory fallback
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

export async function updateExportJob(id: string, updates: Partial<ExportJob>): Promise<void> {
  if (SUPABASE_ENABLED) {
    const updateData: Record<string, any> = {}
    if (updates.status) updateData.status = updates.status
    if (updates.fileName) updateData.filePath = updates.fileName
    await exportJobRepo.update(id, updateData)
    return
  }
  const job = exportJobs.get(id)
  if (job) Object.assign(job, updates)
}

export async function getExportJob(id: string): Promise<ExportJob | null> {
  if (SUPABASE_ENABLED) {
    const result = await exportJobRepo.findById(id)
    return result ? dbExportJobToModel(result) : null
  }
  return exportJobs.get(id) || null
}

// ==================== Progress Functions ====================
// Progress is transient runtime state, kept in-memory

export async function setProgress(projectId: string, progress: GenerationProgress): Promise<void> {
  progressMap.set(projectId, progress)
}

export async function getProgress(projectId: string): Promise<GenerationProgress | null> {
  return progressMap.get(projectId) || null
}

// ==================== Step Data Functions ====================
// Step data is transient wizard state, kept in-memory

const stepDataMap = new Map<string, Map<string, unknown>>()

export async function setStepData(projectId: string, step: string, data: unknown): Promise<void> {
  if (!stepDataMap.has(projectId)) {
    stepDataMap.set(projectId, new Map())
  }
  stepDataMap.get(projectId)!.set(step, data)
}

export async function getStepData(projectId: string, step: string): Promise<unknown | null> {
  return stepDataMap.get(projectId)?.get(step) || null
}

export async function clearStepDataAfter(projectId: string, afterStep: number): Promise<void> {
  const stepNames = ['keywords', 'search', 'extract', 'outline', 'write', 'complete']
  for (let i = afterStep; i < stepNames.length; i++) {
    stepDataMap.get(projectId)?.delete(stepNames[i])
  }

  if (SUPABASE_ENABLED) {
    // Clear database records based on step
    if (afterStep <= 4) {
      await sectionRepo.replaceAll(projectId, [])
      await referenceRepo.replaceAll(projectId, [])
    }
    if (afterStep <= 3) {
      progressMap.set(projectId, { stage: 'keyword_extracting', progress: 0, message: '' })
    }
    if (afterStep <= 2) {
      await projectRepo.updateKeywords(projectId, [])
    }
    if (afterStep <= 1) {
      // Delete all papers for this project
      await db.delete(schema.papers).where(eq(schema.papers.projectId, projectId))
    }
    return
  }

  // In-memory fallback
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

export async function getViewpoints(projectId: string): Promise<string[]> {
  const data = stepDataMap.get(projectId)?.get('extract')
  if (data && typeof data === 'object' && data !== null && 'viewpoints' in data) {
    return (data as { viewpoints: string[] }).viewpoints
  }
  return []
}

export async function setViewpoints(projectId: string, viewpoints: string[]): Promise<void> {
  const existing = (stepDataMap.get(projectId)?.get('extract') || {}) as Record<string, unknown>
  await setStepData(projectId, 'extract', { ...existing, viewpoints })
}

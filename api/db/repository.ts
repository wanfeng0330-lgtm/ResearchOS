import { eq, and, desc } from 'drizzle-orm'
import db from './index.js'
import * as schema from './schema.js'

export const workspaceRepo = {
  async create(data: { name: string; description?: string; settings?: Record<string, unknown> }) {
    const [result] = await db.insert(schema.workspaces).values(data).returning()
    return result
  },

  async findAll() {
    return await db.select().from(schema.workspaces).orderBy(desc(schema.workspaces.updatedAt))
  },

  async findById(id: string) {
    const [result] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, id))
    return result || null
  },

  async update(id: string, data: Partial<{ name: string; description: string; settings: Record<string, unknown> }>) {
    const [result] = await db.update(schema.workspaces)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.workspaces.id, id))
      .returning()
    return result || null
  },

  async delete(id: string) {
    const result = await db.delete(schema.workspaces).where(eq(schema.workspaces.id, id)).returning()
    return result.length > 0
  },
}

export const projectRepo = {
  async create(data: { workspaceId?: string; title: string; topic: string; description?: string; language?: string }) {
    const [result] = await db.insert(schema.projects).values(data).returning()
    return result
  },

  async findAll() {
    return await db.select().from(schema.projects).orderBy(desc(schema.projects.updatedAt))
  },

  async findById(id: string) {
    const [result] = await db.select().from(schema.projects).where(eq(schema.projects.id, id))
    return result || null
  },

  async findByWorkspace(workspaceId: string) {
    return await db.select().from(schema.projects)
      .where(eq(schema.projects.workspaceId, workspaceId))
      .orderBy(desc(schema.projects.updatedAt))
  },

  async updateStatus(id: string, status: string) {
    const [result] = await db.update(schema.projects)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.projects.id, id))
      .returning()
    return result || null
  },

  async updateKeywords(id: string, keywords: string[]) {
    const [result] = await db.update(schema.projects)
      .set({ keywords, updatedAt: new Date() })
      .where(eq(schema.projects.id, id))
      .returning()
    return result || null
  },
}

export const paperRepo = {
  async create(data: {
    projectId: string; title: string; source: string;
    authors?: string[]; year?: number; abstract?: string;
    sourceId?: string; pdfUrl?: string; citationCount?: number;
    keywords?: string[]; bibtex?: string; doi?: string; journal?: string;
    selected?: boolean; relevanceScore?: number;
  }) {
    const [result] = await db.insert(schema.papers).values(data).returning()
    return result
  },

  async findByProject(projectId: string) {
    return await db.select().from(schema.papers)
      .where(eq(schema.papers.projectId, projectId))
      .orderBy(schema.papers.citationNumber)
  },

  async findSelected(projectId: string) {
    return await db.select().from(schema.papers)
      .where(and(eq(schema.papers.projectId, projectId), eq(schema.papers.selected, true)))
  },

  async updateSelection(paperId: string, selected: boolean) {
    const [result] = await db.update(schema.papers)
      .set({ selected })
      .where(eq(schema.papers.id, paperId))
      .returning()
    return result || null
  },

  async updateSummary(paperId: string, summary: string) {
    const [result] = await db.update(schema.papers)
      .set({ summary })
      .where(eq(schema.papers.id, paperId))
      .returning()
    return result || null
  },

  async assignCitationNumber(paperId: string, citationNumber: number) {
    const [result] = await db.update(schema.papers)
      .set({ citationNumber })
      .where(eq(schema.papers.id, paperId))
      .returning()
    return result || null
  },
}

export const sectionRepo = {
  async create(data: {
    projectId: string; type: string; title: string; content: string;
    sectionOrder: number; citations?: unknown[]; wordCount?: number; charts?: unknown[];
  }) {
    const [result] = await db.insert(schema.generatedSections).values(data).returning()
    return result
  },

  async findByProject(projectId: string) {
    return await db.select().from(schema.generatedSections)
      .where(eq(schema.generatedSections.projectId, projectId))
      .orderBy(schema.generatedSections.sectionOrder)
  },

  async replaceAll(projectId: string, sectionsList: Array<{
    type: string; title: string; content: string; sectionOrder: number;
    citations?: unknown[]; wordCount?: number; charts?: unknown[];
  }>) {
    await db.delete(schema.generatedSections).where(eq(schema.generatedSections.projectId, projectId))
    if (sectionsList.length === 0) return []
    const results = await db.insert(schema.generatedSections).values(
      sectionsList.map(s => ({ projectId, ...s }))
    ).returning()
    return results
  },
}

export const referenceRepo = {
  async create(data: { projectId: string; paperId?: string; bibtex?: string; apa?: string; ieee?: string; gbt?: string }) {
    const [result] = await db.insert(schema.references).values(data).returning()
    return result
  },

  async findByProject(projectId: string) {
    return await db.select().from(schema.references)
      .where(eq(schema.references.projectId, projectId))
  },

  async replaceAll(projectId: string, refsList: Array<{
    paperId?: string; bibtex?: string; apa?: string; ieee?: string; gbt?: string;
  }>) {
    await db.delete(schema.references).where(eq(schema.references.projectId, projectId))
    if (refsList.length === 0) return []
    const results = await db.insert(schema.references).values(
      refsList.map(r => ({ projectId, ...r }))
    ).returning()
    return results
  },
}

export const knowledgeRepo = {
  async create(data: { projectId: string; type: string; content: string; sourcePaperIds?: string[]; sectionType?: string }) {
    const [result] = await db.insert(schema.knowledgeEntries).values(data).returning()
    return result
  },

  async findByProject(projectId: string) {
    return await db.select().from(schema.knowledgeEntries)
      .where(eq(schema.knowledgeEntries.projectId, projectId))
      .orderBy(desc(schema.knowledgeEntries.createdAt))
  },

  async findByType(projectId: string, type: string) {
    return await db.select().from(schema.knowledgeEntries)
      .where(and(eq(schema.knowledgeEntries.projectId, projectId), eq(schema.knowledgeEntries.type, type)))
      .orderBy(desc(schema.knowledgeEntries.createdAt))
  },

  async delete(id: string) {
    const result = await db.delete(schema.knowledgeEntries)
      .where(eq(schema.knowledgeEntries.id, id))
      .returning()
    return result.length > 0
  },
}

export const workflowRepo = {
  async findByProject(projectId: string) {
    const [result] = await db.select().from(schema.workflowStates)
      .where(eq(schema.workflowStates.projectId, projectId))
    return result || null
  },

  async upsert(projectId: string, data: {
    currentStage?: string; completedStages?: string[]; failedStage?: string | null;
    stageHistory?: unknown[]; canResume?: boolean; progress?: unknown;
    startedAt?: Date | null;
  }) {
    const existing = await this.findByProject(projectId)
    if (existing) {
      const [result] = await db.update(schema.workflowStates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.workflowStates.projectId, projectId))
        .returning()
      return result
    }
    const [result] = await db.insert(schema.workflowStates)
      .values({ projectId, ...data })
      .returning()
    return result
  },

  async delete(projectId: string) {
    await db.delete(schema.workflowStates).where(eq(schema.workflowStates.projectId, projectId))
  },
}

export const exportJobRepo = {
  async create(data: { projectId: string; format: string; citationFormat: string }) {
    const [result] = await db.insert(schema.exportJobs).values(data).returning()
    return result
  },

  async findById(id: string) {
    const [result] = await db.select().from(schema.exportJobs).where(eq(schema.exportJobs.id, id))
    return result || null
  },

  async update(id: string, data: Partial<{ status: string; filePath: string }>) {
    const [result] = await db.update(schema.exportJobs).set(data)
      .where(eq(schema.exportJobs.id, id))
      .returning()
    return result || null
  },
}

export const embeddingRepo = {
  async create(data: { paperId: string; chunkText: string; chunkIndex: number }) {
    const [result] = await db.insert(schema.paperEmbeddings).values(data).returning()
    return result
  },

  async findByPaper(paperId: string) {
    return await db.select().from(schema.paperEmbeddings)
      .where(eq(schema.paperEmbeddings.paperId, paperId))
      .orderBy(schema.paperEmbeddings.chunkIndex)
  },

  async deleteByPaper(paperId: string) {
    await db.delete(schema.paperEmbeddings).where(eq(schema.paperEmbeddings.paperId, paperId))
  },
}

import { supabase, SUPABASE_ENABLED } from './supabaseClient.js'

// ─── camelCase ↔ snake_case conversion helpers ───────────────────────────────

function toSnakeCaseKey(key: string): string {
  return key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function toSnakeCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCaseKey(key)] = value
  }
  return result
}

function toCamelCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[toCamelCaseKey(key)] = value
  }
  return result
}

function toCamelCaseArray(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => toCamelCase(row))
}

// Table name constants (paper_references instead of references to avoid reserved word)
const TABLES = {
  users: 'users',
  workspaces: 'workspaces',
  projects: 'projects',
  papers: 'papers',
  generatedSections: 'generated_sections',
  paperReferences: 'paper_references',
  knowledgeEntries: 'knowledge_entries',
  workflowStates: 'workflow_states',
  exportJobs: 'export_jobs',
  paperEmbeddings: 'paper_embeddings',
} as const

export const userRepo = {
  async create(data: { email: string; passwordHash: string; name?: string; role?: string }) {
    const row = toSnakeCase({ email: data.email, passwordHash: data.passwordHash, name: data.name || '', role: data.role || 'user' })
    const { data: result, error } = await supabase
      .from(TABLES.users)
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toCamelCase(result)
  },

  async findById(id: string) {
    const { data, error } = await supabase
      .from(TABLES.users)
      .select()
      .eq('id', id)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data ? toCamelCase(data) : null
  },

  async findByEmail(email: string) {
    const { data, error } = await supabase
      .from(TABLES.users)
      .select()
      .eq('email', email)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data ? toCamelCase(data) : null
  },

  async update(id: string, data: Partial<{ name: string; role: string; passwordHash: string }>) {
    const row = toSnakeCase({ ...data, updatedAt: new Date().toISOString() })
    const { data: result, error } = await supabase
      .from(TABLES.users)
      .update(row)
      .eq('id', id)
      .select()
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return result ? toCamelCase(result) : null
  },
}

export const workspaceRepo = {
  async create(data: { name: string; description?: string; settings?: Record<string, unknown> }) {
    const row = toSnakeCase(data)
    const { data: result, error } = await supabase
      .from(TABLES.workspaces)
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toCamelCase(result)
  },

  async findAll() {
    const { data, error } = await supabase
      .from(TABLES.workspaces)
      .select()
      .order('updated_at', { ascending: false })
    if (error) throw error
    return toCamelCaseArray(data)
  },

  async findAllPaginated(limit: number, offset: number) {
    const [rowsResult, countResult] = await Promise.all([
      supabase
        .from(TABLES.workspaces)
        .select()
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from(TABLES.workspaces)
        .select('*', { count: 'exact', head: true }),
    ])
    if (rowsResult.error) throw rowsResult.error
    if (countResult.error) throw countResult.error
    return { rows: toCamelCaseArray(rowsResult.data), total: countResult.count ?? 0 }
  },

  async findById(id: string) {
    const { data, error } = await supabase
      .from(TABLES.workspaces)
      .select()
      .eq('id', id)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data ? toCamelCase(data) : null
  },

  async update(id: string, data: Partial<{ name: string; description: string; settings: Record<string, unknown> }>) {
    const row = toSnakeCase({ ...data, updatedAt: new Date().toISOString() })
    const { data: result, error } = await supabase
      .from(TABLES.workspaces)
      .update(row)
      .eq('id', id)
      .select()
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return result ? toCamelCase(result) : null
  },

  async delete(id: string) {
    const { data, error } = await supabase
      .from(TABLES.workspaces)
      .delete()
      .eq('id', id)
      .select()
    if (error) throw error
    return (data?.length ?? 0) > 0
  },
}

export const projectRepo = {
  async create(data: { workspaceId?: string; title: string; topic: string; description?: string; language?: string }) {
    const row = toSnakeCase(data)
    const { data: result, error } = await supabase
      .from(TABLES.projects)
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toCamelCase(result)
  },

  async findAll() {
    const { data, error } = await supabase
      .from(TABLES.projects)
      .select()
      .order('updated_at', { ascending: false })
    if (error) throw error
    return toCamelCaseArray(data)
  },

  async findAllPaginated(limit: number, offset: number) {
    const [rowsResult, countResult] = await Promise.all([
      supabase
        .from(TABLES.projects)
        .select()
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from(TABLES.projects)
        .select('*', { count: 'exact', head: true }),
    ])
    if (rowsResult.error) throw rowsResult.error
    if (countResult.error) throw countResult.error
    return { rows: toCamelCaseArray(rowsResult.data), total: countResult.count ?? 0 }
  },

  async findById(id: string) {
    const { data, error } = await supabase
      .from(TABLES.projects)
      .select()
      .eq('id', id)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data ? toCamelCase(data) : null
  },

  async findByWorkspace(workspaceId: string) {
    const { data, error } = await supabase
      .from(TABLES.projects)
      .select()
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return toCamelCaseArray(data)
  },

  async updateStatus(id: string, status: string) {
    const row = toSnakeCase({ status, updatedAt: new Date().toISOString() })
    const { data: result, error } = await supabase
      .from(TABLES.projects)
      .update(row)
      .eq('id', id)
      .select()
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return result ? toCamelCase(result) : null
  },

  async updateKeywords(id: string, keywords: string[]) {
    const row = toSnakeCase({ keywords, updatedAt: new Date().toISOString() })
    const { data: result, error } = await supabase
      .from(TABLES.projects)
      .update(row)
      .eq('id', id)
      .select()
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return result ? toCamelCase(result) : null
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
    const row = toSnakeCase(data)
    const { data: result, error } = await supabase
      .from(TABLES.papers)
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toCamelCase(result)
  },

  async findByProject(projectId: string) {
    const { data, error } = await supabase
      .from(TABLES.papers)
      .select()
      .eq('project_id', projectId)
      .order('citation_number', { ascending: true, nullsFirst: true })
    if (error) throw error
    return toCamelCaseArray(data)
  },

  async findSelected(projectId: string) {
    const { data, error } = await supabase
      .from(TABLES.papers)
      .select()
      .eq('project_id', projectId)
      .eq('selected', true)
    if (error) throw error
    return toCamelCaseArray(data)
  },

  async updateSelection(paperId: string, selected: boolean) {
    const { data: result, error } = await supabase
      .from(TABLES.papers)
      .update({ selected })
      .eq('id', paperId)
      .select()
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return result ? toCamelCase(result) : null
  },

  async updateSummary(paperId: string, summary: string) {
    const { data: result, error } = await supabase
      .from(TABLES.papers)
      .update({ summary })
      .eq('id', paperId)
      .select()
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return result ? toCamelCase(result) : null
  },

  async assignCitationNumber(paperId: string, citationNumber: number) {
    const row = toSnakeCase({ citationNumber })
    const { data: result, error } = await supabase
      .from(TABLES.papers)
      .update(row)
      .eq('id', paperId)
      .select()
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return result ? toCamelCase(result) : null
  },
}

export const sectionRepo = {
  async create(data: {
    projectId: string; type: string; title: string; content: string;
    sectionOrder: number; citations?: unknown[]; wordCount?: number; charts?: unknown[];
  }) {
    const row = toSnakeCase(data)
    const { data: result, error } = await supabase
      .from(TABLES.generatedSections)
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toCamelCase(result)
  },

  async findByProject(projectId: string) {
    const { data, error } = await supabase
      .from(TABLES.generatedSections)
      .select()
      .eq('project_id', projectId)
      .order('section_order', { ascending: true })
    if (error) throw error
    return toCamelCaseArray(data)
  },

  async replaceAll(projectId: string, sectionsList: Array<{
    type: string; title: string; content: string; sectionOrder: number;
    citations?: unknown[]; wordCount?: number; charts?: unknown[];
  }>) {
    const { error: deleteError } = await supabase
      .from(TABLES.generatedSections)
      .delete()
      .eq('project_id', projectId)
    if (deleteError) throw deleteError

    if (sectionsList.length === 0) return []

    const rows = sectionsList.map(s => toSnakeCase({ projectId, ...s }))
    const { data: results, error: insertError } = await supabase
      .from(TABLES.generatedSections)
      .insert(rows)
      .select()
    if (insertError) throw insertError
    return toCamelCaseArray(results)
  },
}

export const referenceRepo = {
  async create(data: { projectId: string; paperId?: string; bibtex?: string; apa?: string; ieee?: string; gbt?: string }) {
    const row = toSnakeCase(data)
    const { data: result, error } = await supabase
      .from(TABLES.paperReferences)
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toCamelCase(result)
  },

  async findByProject(projectId: string) {
    const { data, error } = await supabase
      .from(TABLES.paperReferences)
      .select()
      .eq('project_id', projectId)
    if (error) throw error
    return toCamelCaseArray(data)
  },

  async replaceAll(projectId: string, refsList: Array<{
    paperId?: string; bibtex?: string; apa?: string; ieee?: string; gbt?: string;
  }>) {
    const { error: deleteError } = await supabase
      .from(TABLES.paperReferences)
      .delete()
      .eq('project_id', projectId)
    if (deleteError) throw deleteError

    if (refsList.length === 0) return []

    const rows = refsList.map(r => toSnakeCase({ projectId, ...r }))
    const { data: results, error: insertError } = await supabase
      .from(TABLES.paperReferences)
      .insert(rows)
      .select()
    if (insertError) throw insertError
    return toCamelCaseArray(results)
  },
}

export const knowledgeRepo = {
  async create(data: { projectId: string; type: string; content: string; sourcePaperIds?: string[]; sectionType?: string }) {
    const row = toSnakeCase(data)
    const { data: result, error } = await supabase
      .from(TABLES.knowledgeEntries)
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toCamelCase(result)
  },

  async findByProject(projectId: string) {
    const { data, error } = await supabase
      .from(TABLES.knowledgeEntries)
      .select()
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return toCamelCaseArray(data)
  },

  async findByType(projectId: string, type: string) {
    const { data, error } = await supabase
      .from(TABLES.knowledgeEntries)
      .select()
      .eq('project_id', projectId)
      .eq('type', type)
      .order('created_at', { ascending: false })
    if (error) throw error
    return toCamelCaseArray(data)
  },

  async delete(id: string) {
    const { data, error } = await supabase
      .from(TABLES.knowledgeEntries)
      .delete()
      .eq('id', id)
      .select()
    if (error) throw error
    return (data?.length ?? 0) > 0
  },

  async deleteByProject(projectId: string) {
    const { error } = await supabase
      .from(TABLES.knowledgeEntries)
      .delete()
      .eq('project_id', projectId)
    if (error) throw error
  },
}

export const workflowRepo = {
  async findByProject(projectId: string) {
    const { data, error } = await supabase
      .from(TABLES.workflowStates)
      .select()
      .eq('project_id', projectId)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data ? toCamelCase(data) : null
  },

  async upsert(projectId: string, data: {
    currentStage?: string; completedStages?: string[]; failedStage?: string | null;
    stageHistory?: unknown[]; canResume?: boolean; progress?: unknown;
    startedAt?: Date | null;
  }) {
    const existing = await this.findByProject(projectId)
    const payload = toSnakeCase({
      ...data,
      startedAt: data.startedAt instanceof Date ? data.startedAt.toISOString() : data.startedAt,
      updatedAt: new Date().toISOString(),
    })

    if (existing) {
      const { data: result, error } = await supabase
        .from(TABLES.workflowStates)
        .update(payload)
        .eq('project_id', projectId)
        .select()
        .single()
      if (error) throw error
      return toCamelCase(result)
    }

    const { data: result, error } = await supabase
      .from(TABLES.workflowStates)
      .insert({ project_id: projectId, ...payload })
      .select()
      .single()
    if (error) throw error
    return toCamelCase(result)
  },

  async delete(projectId: string) {
    const { error } = await supabase
      .from(TABLES.workflowStates)
      .delete()
      .eq('project_id', projectId)
    if (error) throw error
  },
}

export const exportJobRepo = {
  async create(data: { projectId: string; format: string; citationFormat: string }) {
    const row = toSnakeCase(data)
    const { data: result, error } = await supabase
      .from(TABLES.exportJobs)
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toCamelCase(result)
  },

  async findById(id: string) {
    const { data, error } = await supabase
      .from(TABLES.exportJobs)
      .select()
      .eq('id', id)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data ? toCamelCase(data) : null
  },

  async update(id: string, data: Partial<{ status: string; filePath: string }>) {
    const row = toSnakeCase(data)
    const { data: result, error } = await supabase
      .from(TABLES.exportJobs)
      .update(row)
      .eq('id', id)
      .select()
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return result ? toCamelCase(result) : null
  },
}

export const embeddingRepo = {
  async create(data: { paperId: string; chunkText: string; chunkIndex: number }) {
    const row = toSnakeCase(data)
    const { data: result, error } = await supabase
      .from(TABLES.paperEmbeddings)
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toCamelCase(result)
  },

  async findByPaper(paperId: string) {
    const { data, error } = await supabase
      .from(TABLES.paperEmbeddings)
      .select()
      .eq('paper_id', paperId)
      .order('chunk_index', { ascending: true })
    if (error) throw error
    return toCamelCaseArray(data)
  },

  async deleteByPaper(paperId: string) {
    const { error } = await supabase
      .from(TABLES.paperEmbeddings)
      .delete()
      .eq('paper_id', paperId)
    if (error) throw error
  },
}

export { SUPABASE_ENABLED }

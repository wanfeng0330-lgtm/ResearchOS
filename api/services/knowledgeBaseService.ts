import { v4 as uuidv4 } from 'uuid'
import type { KnowledgeEntry } from '../../shared/types.js'
import { SUPABASE_ENABLED } from '../db/supabaseClient.js'
import { knowledgeRepo } from '../db/supabaseRepository.js'

// In-memory fallback storage (used when DB is disabled)
const knowledgeEntries = new Map<string, KnowledgeEntry[]>()

// Helper to convert DB knowledge entry result to shared KnowledgeEntry type
function toKnowledgeEntry(row: any): KnowledgeEntry {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    content: row.content,
    sourcePaperIds: row.sourcePaperIds || [],
    sectionType: row.sectionType ?? undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  }
}

export async function getEntries(projectId: string): Promise<KnowledgeEntry[]> {
  if (SUPABASE_ENABLED) {
    const rows = await knowledgeRepo.findByProject(projectId)
    return rows.map(toKnowledgeEntry)
  }
  return knowledgeEntries.get(projectId) || []
}

export async function getEntriesByType(projectId: string, type: KnowledgeEntry['type']): Promise<KnowledgeEntry[]> {
  if (SUPABASE_ENABLED) {
    const rows = await knowledgeRepo.findByType(projectId, type)
    return rows.map(toKnowledgeEntry)
  }
  return (knowledgeEntries.get(projectId) || []).filter(e => e.type === type)
}

export async function addEntry(projectId: string, type: KnowledgeEntry['type'], content: string, sourcePaperIds: string[] = [], sectionType?: string): Promise<KnowledgeEntry> {
  if (SUPABASE_ENABLED) {
    const row = await knowledgeRepo.create({ projectId, type, content, sourcePaperIds, sectionType })
    return toKnowledgeEntry(row)
  }
  const entries = knowledgeEntries.get(projectId) || []
  const entry: KnowledgeEntry = {
    id: uuidv4(),
    projectId,
    type,
    content,
    sourcePaperIds,
    sectionType,
    createdAt: new Date().toISOString(),
  }
  entries.push(entry)
  knowledgeEntries.set(projectId, entries)
  return entry
}

export async function addViewpoints(projectId: string, viewpoints: string[], sourcePaperIds: string[] = [], sectionType?: string): Promise<KnowledgeEntry[]> {
  const results: KnowledgeEntry[] = []
  for (const vp of viewpoints) {
    results.push(await addEntry(projectId, 'viewpoint', vp, sourcePaperIds, sectionType))
  }
  return results
}

export async function addSummary(projectId: string, paperId: string, content: string): Promise<KnowledgeEntry> {
  return addEntry(projectId, 'summary', content, [paperId])
}

export async function getSummary(projectId: string, paperId: string): Promise<KnowledgeEntry | null> {
  if (SUPABASE_ENABLED) {
    const rows = await knowledgeRepo.findByType(projectId, 'summary')
    const match = rows.find(e => (e.sourcePaperIds || []).includes(paperId))
    return match ? toKnowledgeEntry(match) : null
  }
  return (knowledgeEntries.get(projectId) || []).find(e => e.type === 'summary' && e.sourcePaperIds.includes(paperId)) || null
}

export async function addNote(projectId: string, content: string, sourcePaperIds: string[] = []): Promise<KnowledgeEntry> {
  return addEntry(projectId, 'note', content, sourcePaperIds)
}

export async function deleteEntry(projectId: string, entryId: string): Promise<boolean> {
  if (SUPABASE_ENABLED) {
    return knowledgeRepo.delete(entryId)
  }
  const entries = knowledgeEntries.get(projectId) || []
  const index = entries.findIndex(e => e.id === entryId)
  if (index < 0) return false
  entries.splice(index, 1)
  return true
}

export async function getViewpointsBySectionType(projectId: string, sectionType: string): Promise<KnowledgeEntry[]> {
  if (SUPABASE_ENABLED) {
    const rows = await knowledgeRepo.findByType(projectId, 'viewpoint')
    return rows
      .filter(e => !e.sectionType || e.sectionType === sectionType)
      .map(toKnowledgeEntry)
  }
  return (knowledgeEntries.get(projectId) || [])
    .filter(e => e.type === 'viewpoint' && (!e.sectionType || e.sectionType === sectionType))
}

export async function clearProjectEntries(projectId: string): Promise<void> {
  if (SUPABASE_ENABLED) {
    await knowledgeRepo.deleteByProject(projectId)
    return
  }
  knowledgeEntries.delete(projectId)
}

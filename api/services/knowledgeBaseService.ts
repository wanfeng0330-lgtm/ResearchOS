import { v4 as uuidv4 } from 'uuid'
import type { KnowledgeEntry } from '../../shared/types.js'

const knowledgeEntries = new Map<string, KnowledgeEntry[]>()

export function getEntries(projectId: string): KnowledgeEntry[] {
  return knowledgeEntries.get(projectId) || []
}

export function getEntriesByType(projectId: string, type: KnowledgeEntry['type']): KnowledgeEntry[] {
  return (knowledgeEntries.get(projectId) || []).filter(e => e.type === type)
}

export function addEntry(projectId: string, type: KnowledgeEntry['type'], content: string, sourcePaperIds: string[] = [], sectionType?: string): KnowledgeEntry {
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

export function addViewpoints(projectId: string, viewpoints: string[], sourcePaperIds: string[] = [], sectionType?: string): KnowledgeEntry[] {
  return viewpoints.map(vp => addEntry(projectId, 'viewpoint', vp, sourcePaperIds, sectionType))
}

export function addSummary(projectId: string, paperId: string, content: string): KnowledgeEntry {
  return addEntry(projectId, 'summary', content, [paperId])
}

export function getSummary(projectId: string, paperId: string): KnowledgeEntry | null {
  const entries = knowledgeEntries.get(projectId) || []
  return entries.find(e => e.type === 'summary' && e.sourcePaperIds.includes(paperId)) || null
}

export function addNote(projectId: string, content: string, sourcePaperIds: string[] = []): KnowledgeEntry {
  return addEntry(projectId, 'note', content, sourcePaperIds)
}

export function deleteEntry(projectId: string, entryId: string): boolean {
  const entries = knowledgeEntries.get(projectId) || []
  const index = entries.findIndex(e => e.id === entryId)
  if (index < 0) return false
  entries.splice(index, 1)
  return true
}

export function getViewpointsBySectionType(projectId: string, sectionType: string): KnowledgeEntry[] {
  return (knowledgeEntries.get(projectId) || [])
    .filter(e => e.type === 'viewpoint' && (!e.sectionType || e.sectionType === sectionType))
}

export function clearProjectEntries(projectId: string): void {
  knowledgeEntries.delete(projectId)
}

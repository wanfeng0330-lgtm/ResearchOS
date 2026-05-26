import type { Paper } from '../../shared/types.js'

const paperTags = new Map<string, Map<string, string[]>>()
const paperNotes = new Map<string, Map<string, string>>()
const paperSummaries = new Map<string, Map<string, string>>()
const paperCitationNumbers = new Map<string, Map<string, number>>()

export function getTags(projectId: string, paperId: string): string[] {
  return paperTags.get(projectId)?.get(paperId) || []
}

export function setTags(projectId: string, paperId: string, tags: string[]): void {
  if (!paperTags.has(projectId)) paperTags.set(projectId, new Map())
  paperTags.get(projectId)!.set(paperId, tags)
}

export function getNotes(projectId: string, paperId: string): string {
  return paperNotes.get(projectId)?.get(paperId) || ''
}

export function setNotes(projectId: string, paperId: string, notes: string): void {
  if (!paperNotes.has(projectId)) paperNotes.set(projectId, new Map())
  paperNotes.get(projectId)!.set(paperId, notes)
}

export function getCachedSummary(projectId: string, paperId: string): string | null {
  return paperSummaries.get(projectId)?.get(paperId) || null
}

export function setCachedSummary(projectId: string, paperId: string, summary: string): void {
  if (!paperSummaries.has(projectId)) paperSummaries.set(projectId, new Map())
  paperSummaries.get(projectId)!.set(paperId, summary)
}

export function assignCitationNumbers(projectId: string, papers: Paper[]): Paper[] {
  if (!paperCitationNumbers.has(projectId)) paperCitationNumbers.set(projectId, new Map())
  const numberMap = paperCitationNumbers.get(projectId)!
  let nextNumber = 1

  return papers.map(paper => {
    if (!numberMap.has(paper.id)) {
      numberMap.set(paper.id, nextNumber)
      nextNumber++
    }
    return { ...paper, citationNumber: numberMap.get(paper.id) }
  })
}

export function getCitationNumber(projectId: string, paperId: string): number | null {
  return paperCitationNumbers.get(projectId)?.get(paperId) || null
}

export function clearProjectData(projectId: string): void {
  paperTags.delete(projectId)
  paperNotes.delete(projectId)
  paperSummaries.delete(projectId)
  paperCitationNumbers.delete(projectId)
}

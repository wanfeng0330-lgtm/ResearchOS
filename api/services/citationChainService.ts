import { v4 as uuidv4 } from 'uuid'
import type { CitationChainLink } from '../../shared/types.js'

const citationChains = new Map<string, CitationChainLink[]>()

export async function getChain(projectId: string): Promise<CitationChainLink[]> {
  return citationChains.get(projectId) || []
}

export async function addLink(projectId: string, paperId: string, sectionId: string, context: string): Promise<CitationChainLink> {
  const chain = citationChains.get(projectId) || []
  const link: CitationChainLink = {
    id: uuidv4(),
    projectId,
    paperId,
    sectionId,
    context,
    createdAt: new Date().toISOString(),
  }
  chain.push(link)
  citationChains.set(projectId, chain)
  return link
}

export async function removeLink(projectId: string, linkId: string): Promise<boolean> {
  const chain = citationChains.get(projectId) || []
  const index = chain.findIndex(l => l.id === linkId)
  if (index < 0) return false
  chain.splice(index, 1)
  return true
}

export async function getLinksByPaper(projectId: string, paperId: string): Promise<CitationChainLink[]> {
  return (citationChains.get(projectId) || []).filter(l => l.paperId === paperId)
}

export async function getLinksBySection(projectId: string, sectionId: string): Promise<CitationChainLink[]> {
  return (citationChains.get(projectId) || []).filter(l => l.sectionId === sectionId)
}

export async function rebuildChainFromSections(projectId: string, sections: Array<{ id: string; content: string; citations: Array<{ paperId: string }> }>): Promise<void> {
  const chain: CitationChainLink[] = []
  for (const section of sections) {
    for (const citation of section.citations) {
      const contextMatch = section.content.match(new RegExp(`\\[\\d+\\][^\\[]{0,100}`, 'g'))
      const context = contextMatch ? contextMatch[0].slice(0, 100) : ''
      chain.push({
        id: uuidv4(),
        projectId,
        paperId: citation.paperId,
        sectionId: section.id,
        context,
        createdAt: new Date().toISOString(),
      })
    }
  }
  citationChains.set(projectId, chain)
}

export async function clearChain(projectId: string): Promise<void> {
  citationChains.delete(projectId)
}

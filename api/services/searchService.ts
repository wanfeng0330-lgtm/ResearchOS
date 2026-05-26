import { v4 as uuidv4 } from 'uuid'
import type { Paper } from '../../shared/types.js'

function extractText(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : ''
}

function extractEntries(xml: string): string[] {
  const entries: string[] = []
  const regex = /<entry>([\s\S]*?)<\/entry>/gi
  let match
  while ((match = regex.exec(xml)) !== null) {
    entries.push(match[1])
  }
  return entries
}

export async function searchArxiv(query: string, maxResults: number = 10): Promise<Paper[]> {
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${maxResults}`

  const response = await fetch(url)
  if (!response.ok) throw new Error(`arXiv API error: ${response.status}`)

  const xml = await response.text()
  const entries = extractEntries(xml)

  return entries.map((entry) => {
    const title = extractText(entry, 'title').replace(/\s+/g, ' ')
    const summary = extractText(entry, 'summary').replace(/\s+/g, ' ')
    const idMatch = entry.match(/<id>([^<]+)<\/id>/)
    const sourceId = idMatch ? idMatch[1].trim() : ''
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/)
    const year = publishedMatch ? new Date(publishedMatch[1]).getFullYear() : new Date().getFullYear()

    const authors: string[] = []
    const authorRegex = /<name>([^<]+)<\/name>/g
    let authorMatch
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push(authorMatch[1].trim())
    }

    const pdfMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/)
    const pdfUrl = pdfMatch ? pdfMatch[1] : undefined

    const arxivId = sourceId.replace('http://arxiv.org/abs/', '')

    return {
      id: uuidv4(),
      projectId: '',
      title,
      authors,
      year,
      abstract: summary,
      source: 'arxiv' as const,
      sourceId: arxivId,
      pdfUrl,
      selected: false,
      bibtex: `@article{${arxivId},\n  title={${title}},\n  author={${authors.join(' and ')}},\n  year={${year}},\n  eprint={${arxivId}},\n  archivePrefix={arXiv}\n}`,
    }
  })
}

export async function searchSemanticScholar(query: string, maxResults: number = 10): Promise<Paper[]> {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${maxResults}&fields=paperId,title,abstract,authors,year,citationCount,externalIds,url,journal`

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Semantic Scholar API error: ${response.status}`)

  const data = await response.json()
  const papers = data.data || []

  return papers.map((p: any) => {
    const authors = (p.authors || []).map((a: any) => a.name || '')
    const sourceId = p.paperId || ''
    const doi = p.externalIds?.DOI || ''
    const journal = p.journal?.name || ''

    return {
      id: uuidv4(),
      projectId: '',
      title: p.title || '',
      authors,
      year: p.year || new Date().getFullYear(),
      abstract: p.abstract || '',
      source: 'semantic_scholar' as const,
      sourceId,
      pdfUrl: p.url ? `https://www.semanticscholar.org/paper/${sourceId}` : undefined,
      citationCount: p.citationCount || 0,
      selected: false,
      doi,
      journal,
      bibtex: `@article{${sourceId},\n  title={${p.title || ''}},\n  author={${authors.join(' and ')}},\n  year={${p.year || ''}},\n  doi={${doi}}\n}`,
    }
  })
}

export async function searchCrossref(query: string, maxResults: number = 10): Promise<Paper[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${maxResults}`

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Crossref API error: ${response.status}`)

  const data = await response.json()
  const items = data.message?.items || []

  return items.map((item: any) => {
    const authors = (item.author || []).map((a: any) =>
      `${a.given || ''} ${a.family || ''}`.trim()
    )
    const title = (item.title || [])[0] || ''
    const doi = item.DOI || ''
    const year = item.published?.['date-parts']?.[0]?.[0] || item.created?.['date-parts']?.[0]?.[0] || new Date().getFullYear()
    const sourceId = doi || item.URL || ''
    const journal = item['container-title']?.[0] || ''

    return {
      id: uuidv4(),
      projectId: '',
      title,
      authors,
      year,
      abstract: (item.abstract || '').replace(/<[^>]+>/g, ''),
      source: 'crossref' as const,
      sourceId,
      pdfUrl: item.link?.[0]?.URL || undefined,
      citationCount: item['is-referenced-by-count'] || 0,
      selected: false,
      doi,
      journal,
      bibtex: `@article{${doi || sourceId},\n  title={${title}},\n  author={${authors.join(' and ')}},\n  year={${year}},\n  doi={${doi}}\n}`,
    }
  })
}

export async function searchAll(
  query: string,
  sources: string[] = ['arxiv', 'semantic_scholar', 'crossref'],
  maxResults: number = 10
): Promise<Paper[]> {
  const searchPromises: Promise<Paper[]>[] = []

  if (sources.includes('arxiv')) {
    searchPromises.push(searchArxiv(query, maxResults).catch(() => []))
  }
  if (sources.includes('semantic_scholar')) {
    searchPromises.push(searchSemanticScholar(query, maxResults).catch(() => []))
  }
  if (sources.includes('crossref')) {
    searchPromises.push(searchCrossref(query, maxResults).catch(() => []))
  }

  const results = await Promise.all(searchPromises)
  const allPapers = results.flat()

  const seen = new Set<string>()
  return allPapers.filter((paper) => {
    const key = `${paper.title.toLowerCase().trim()}_${paper.year}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  )
}

export function scoreRelevance(papers: Paper[], query: string): Paper[] {
  const queryTokens = tokenize(query)
  if (queryTokens.size === 0) return papers

  const currentYear = new Date().getFullYear()
  const maxCitations = Math.max(...papers.map((p) => p.citationCount || 0), 1)

  const scored = papers.map((paper) => {
    const titleTokens = tokenize(paper.title)
    const abstractTokens = tokenize(paper.abstract || '')

    const titleOverlap = queryTokens.size > 0
      ? Array.from(queryTokens).filter((t) => titleTokens.has(t)).length / queryTokens.size
      : 0

    const abstractOverlap = queryTokens.size > 0
      ? Array.from(queryTokens).filter((t) => abstractTokens.has(t)).length / queryTokens.size
      : 0

    const citationNorm = (paper.citationCount || 0) / maxCitations

    const age = currentYear - paper.year
    const recency = Math.max(0, 1 - age / 20)

    const relevanceScore =
      titleOverlap * 0.3 +
      abstractOverlap * 0.4 +
      citationNorm * 0.2 +
      recency * 0.1

    return { ...paper, relevanceScore }
  })

  return scored.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
}

export async function searchAndRank(
  query: string,
  maxResults: number = 10,
  sources: string[] = ['arxiv', 'semantic_scholar', 'crossref']
): Promise<Paper[]> {
  const papers = await searchAll(query, sources, maxResults)
  const ranked = scoreRelevance(papers, query)

  const topCount = Math.ceil(ranked.length * 0.6)
  return ranked.map((paper, index) => ({
    ...paper,
    selected: index < topCount,
  }))
}

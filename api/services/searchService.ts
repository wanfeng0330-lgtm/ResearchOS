import { v4 as uuidv4 } from 'uuid'
import type { Paper } from '../../shared/types.js'

async function fetchWithRetry(url: string, options?: RequestInit, retries: number = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, options)
    if (response.ok) return response
    if (response.status === 429 && attempt < retries - 1) {
      const delay = Math.pow(2, attempt) * 3000 + Math.random() * 2000
      console.warn(`[fetchWithRetry] 429 rate limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retries})`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      continue
    }
    return response
  }
  throw new Error(`Max retries exceeded for ${url}`)
}

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

  const response = await fetchWithRetry(url, {
    headers: {
      'User-Agent': 'ResearchOS/1.0 (https://github.com/wanfeng0330-lgtm/ResearchOS)',
    },
    signal: AbortSignal.timeout(30000),
  })
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

  const headers: Record<string, string> = { 'User-Agent': 'ResearchOS/1.0' }
  const ssApiKey = process.env.SEMANTIC_SCHOLAR_API_KEY
  if (ssApiKey) {
    headers['x-api-key'] = ssApiKey
  }

  const response = await fetchWithRetry(url, {
    headers,
    signal: AbortSignal.timeout(30000),
  })
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

  const response = await fetchWithRetry(url, { signal: AbortSignal.timeout(30000) })
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

function reconstructAbstract(invertedIndex: Record<string, number[]> | null): string {
  if (!invertedIndex) return ''
  const positions: Map<number, string> = new Map()
  for (const [word, indices] of Object.entries(invertedIndex)) {
    for (const idx of indices) {
      positions.set(idx, word)
    }
  }
  const sorted = Array.from(positions.entries()).sort((a, b) => a[0] - b[0])
  return sorted.map(([, word]) => word).join(' ')
}

export async function searchOpenAlex(query: string, maxResults: number = 10): Promise<Paper[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${maxResults}&sort=relevance_score:desc`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ResearchOS/1.0 (https://github.com/wanfeng0330-lgtm/ResearchOS)',
      },
      signal: AbortSignal.timeout(20000),
    })

    if (!response.ok) {
      console.error(`[OpenAlex] API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    const results = data.results || []

    return results.map((r: any) => {
      const authors = (r.authorships || []).map((a: any) => a.author?.display_name || '').filter(Boolean)
      const doi = r.doi ? r.doi.replace('https://doi.org/', '') : undefined
      const journal = r.primary_location?.source?.display_name || ''
      const abstract = reconstructAbstract(r.abstract_inverted_index)
      const sourceId = r.id || `openalex_${Date.now()}`

      return {
        id: uuidv4(),
        projectId: '',
        title: r.title || '',
        authors: authors.length > 0 ? authors : ['未知作者'],
        year: r.publication_year || new Date().getFullYear(),
        abstract,
        source: 'openalex' as const,
        sourceId,
        pdfUrl: r.primary_location?.landing_page_url || r.doi || undefined,
        citationCount: r.cited_by_count || 0,
        selected: false,
        doi,
        journal,
        keywords: r.keywords?.map((k: any) => k.display_name || k.keyword || '').filter(Boolean) || [],
        bibtex: `@article{${sourceId},\n  title={${r.title || ''}},\n  author={${authors.join(' and ')}},\n  year={${r.publication_year || ''}},\n  journal={${journal}},\n  doi={${doi || ''}}\n}`,
      }
    })
  } catch (error) {
    console.error('[OpenAlex] Search failed:', error instanceof Error ? error.message : error)
    return []
  }
}

export async function searchPubMed(query: string, maxResults: number = 10): Promise<Paper[]> {
  const apiKey = process.env.PUBMED_API_KEY || ''
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json${apiKey ? `&api_key=${apiKey}` : ''}`

  try {
    const searchResponse = await fetchWithRetry(searchUrl, {
      headers: { 'User-Agent': 'ResearchOS/1.0' },
      signal: AbortSignal.timeout(20000),
    })
    if (!searchResponse.ok) throw new Error(`PubMed search error: ${searchResponse.status}`)

    const searchData = await searchResponse.json()
    const pmids: string[] = searchData.esearchresult?.idlist || []
    if (pmids.length === 0) return []

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml${apiKey ? `&api_key=${apiKey}` : ''}`
    const fetchResponse = await fetchWithRetry(fetchUrl, {
      headers: { 'User-Agent': 'ResearchOS/1.0' },
      signal: AbortSignal.timeout(30000),
    })
    if (!fetchResponse.ok) throw new Error(`PubMed fetch error: ${fetchResponse.status}`)

    const xml = await fetchResponse.text()
    const articles: Paper[] = []
    const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/gi
    let articleMatch

    while ((articleMatch = articleRegex.exec(xml)) !== null) {
      const articleXml = articleMatch[1]

      const titleMatch = articleXml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : ''
      if (!title) continue

      const abstractParts: string[] = []
      const absRegex = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi
      let absMatch
      while ((absMatch = absRegex.exec(articleXml)) !== null) {
        const label = absMatch[0].match(/Label="([^"]+)"/)
        const text = absMatch[1].replace(/<[^>]+>/g, '').trim()
        abstractParts.push(label ? `${label[1]}: ${text}` : text)
      }
      const abstract = abstractParts.join(' ')

      const authors: string[] = []
      const authorRegex = /<Author[^>]*>[\s\S]*?<LastName>([^<]+)<\/LastName>[\s\S]*?<ForeName>([^<]+)<\/ForeName>/gi
      let authorMatch2
      while ((authorMatch2 = authorRegex.exec(articleXml)) !== null) {
        authors.push(`${authorMatch2[2]} ${authorMatch2[1]}`)
      }

      const yearMatch = articleXml.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)
      const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear()

      const pmidMatch = articleXml.match(/<PMID[^>]*>(\d+)<\/PMID>/)
      const pmid = pmidMatch ? pmidMatch[1] : ''

      const doiMatch = articleXml.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/)
      const doi = doiMatch ? doiMatch[1] : undefined

      const journalMatch = articleXml.match(/<Title>([^<]+)<\/Title>/)
      const journal = journalMatch ? journalMatch[1] : ''

      articles.push({
        id: uuidv4(),
        projectId: '',
        title,
        authors: authors.length > 0 ? authors : ['Unknown'],
        year,
        abstract,
        source: 'pubmed' as const,
        sourceId: pmid,
        pdfUrl: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined,
        citationCount: 0,
        selected: false,
        doi,
        journal,
        bibtex: `@article{PMID:${pmid},\n  title={${title}},\n  author={${authors.join(' and ')}},\n  year={${year}},\n  journal={${journal}},\n  pmid={${pmid}},\n  doi={${doi || ''}}\n}`,
      })
    }

    console.log(`[PubMed] Found ${articles.length} papers for "${query}"`)
    return articles
  } catch (error) {
    console.error('[PubMed] Search failed:', error instanceof Error ? error.message : error)
    return []
  }
}

export async function searchBioRxiv(query: string, maxResults: number = 10): Promise<Paper[]> {
  const url = `https://api.biorxiv.org/details/biorxiv/${encodeURIComponent(query)}/${0}/${maxResults}`

  try {
    const response = await fetchWithRetry(url, {
      headers: { 'User-Agent': 'ResearchOS/1.0' },
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) throw new Error(`bioRxiv API error: ${response.status}`)

    const data = await response.json()
    const collection = data.collection || []
    if (collection.length === 0) return []

    return collection.map((item: any) => {
      const title = item.title || ''
      const authors = (item.authors || '').split(';').map((a: string) => a.trim()).filter(Boolean)
      const year = item.date ? new Date(item.date).getFullYear() : new Date().getFullYear()
      const doi = item.doi || ''
      const sourceId = doi || item.doi_api || `biorxiv_${Date.now()}`

      return {
        id: uuidv4(),
        projectId: '',
        title,
        authors: authors.length > 0 ? authors : ['Unknown'],
        year,
        abstract: item.abstract || '',
        source: 'biorxiv' as const,
        sourceId,
        pdfUrl: doi ? `https://doi.org/${doi}` : undefined,
        citationCount: 0,
        selected: false,
        doi: doi || undefined,
        journal: 'bioRxiv',
        bibtex: `@article{${sourceId},\n  title={${title}},\n  author={${authors.join(' and ')}},\n  year={${year}},\n  journal={bioRxiv},\n  doi={${doi}}\n}`,
      }
    })
  } catch (error) {
    console.error('[bioRxiv] Search failed:', error instanceof Error ? error.message : error)
    return []
  }
}

export async function searchUnpaywall(doi: string): Promise<Paper | null> {
  const email = process.env.UNPAYWALL_EMAIL || 'researchos@example.com'
  const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ResearchOS/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return null

    const data = await response.json()
    const bestOa = data.best_oa_location

    return {
      id: uuidv4(),
      projectId: '',
      title: data.title || '',
      authors: (data.z_authors || []).map((a: any) => a.given ? `${a.given} ${a.family || ''}`.trim() : (a.family || '')),
      year: data.year || new Date().getFullYear(),
      abstract: '',
      source: 'unpaywall' as const,
      sourceId: data.doi || doi,
      pdfUrl: bestOa?.url_for_pdf || bestOa?.url_for_landing_page || undefined,
      citationCount: 0,
      selected: false,
      doi: data.doi || doi,
      journal: data.journal_name || '',
      bibtex: `@article{${data.doi || doi},\n  title={${data.title || ''}},\n  year={${data.year || ''}},\n  journal={${data.journal_name || ''}},\n  doi={${data.doi || doi}}\n}`,
    }
  } catch (error) {
    console.error('[Unpaywall] Lookup failed:', error instanceof Error ? error.message : error)
    return null
  }
}

export async function enrichWithUnpaywall(papers: Paper[]): Promise<Paper[]> {
  const papersWithDoi = papers.filter((p) => p.doi && !p.pdfUrl)
  if (papersWithDoi.length === 0) return papers

  console.log(`[Unpaywall] Enriching ${papersWithDoi.length} papers with open access PDFs...`)
  let enriched = 0

  for (const paper of papersWithDoi.slice(0, 20)) {
    const oaPaper = await searchUnpaywall(paper.doi!)
    if (oaPaper?.pdfUrl) {
      paper.pdfUrl = oaPaper.pdfUrl
      enriched++
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  console.log(`[Unpaywall] Enriched ${enriched} papers with PDF links`)
  return papers
}

export async function searchAll(
  query: string,
  sources: string[] = ['arxiv', 'semantic_scholar', 'crossref', 'openalex', 'pubmed', 'biorxiv'],
  maxResults: number = 10
): Promise<Paper[]> {
  const searchPromises: Promise<Paper[]>[] = []

  if (sources.includes('arxiv')) {
    searchPromises.push(
      searchArxiv(query, maxResults)
        .then((r) => { console.log(`[SearchAll] arXiv: ${r.length} papers`); return r })
        .catch((e) => { console.error(`[SearchAll] arXiv failed:`, e instanceof Error ? e.message : e); return [] })
    )
  }
  if (sources.includes('semantic_scholar')) {
    searchPromises.push(
      searchSemanticScholar(query, maxResults)
        .then((r) => { console.log(`[SearchAll] Semantic Scholar: ${r.length} papers`); return r })
        .catch((e) => { console.error(`[SearchAll] Semantic Scholar failed:`, e instanceof Error ? e.message : e); return [] })
    )
  }
  if (sources.includes('crossref')) {
    searchPromises.push(
      searchCrossref(query, maxResults)
        .then((r) => { console.log(`[SearchAll] Crossref: ${r.length} papers`); return r })
        .catch((e) => { console.error(`[SearchAll] Crossref failed:`, e instanceof Error ? e.message : e); return [] })
    )
  }
  if (sources.includes('openalex')) {
    searchPromises.push(
      searchOpenAlex(query, maxResults)
        .then((r) => { console.log(`[SearchAll] OpenAlex: ${r.length} papers`); return r })
        .catch((e) => { console.error(`[SearchAll] OpenAlex failed:`, e instanceof Error ? e.message : e); return [] })
    )
  }
  if (sources.includes('pubmed')) {
    searchPromises.push(
      searchPubMed(query, maxResults)
        .then((r) => { console.log(`[SearchAll] PubMed: ${r.length} papers`); return r })
        .catch((e) => { console.error(`[SearchAll] PubMed failed:`, e instanceof Error ? e.message : e); return [] })
    )
  }
  if (sources.includes('biorxiv')) {
    searchPromises.push(
      searchBioRxiv(query, maxResults)
        .then((r) => { console.log(`[SearchAll] bioRxiv: ${r.length} papers`); return r })
        .catch((e) => { console.error(`[SearchAll] bioRxiv failed:`, e instanceof Error ? e.message : e); return [] })
    )
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
  sources: string[] = ['arxiv', 'semantic_scholar', 'crossref', 'openalex']
): Promise<Paper[]> {
  const papers = await searchAll(query, sources, maxResults)
  const ranked = scoreRelevance(papers, query)

  const topCount = Math.ceil(ranked.length * 0.6)
  return ranked.map((paper, index) => ({
    ...paper,
    selected: index < topCount,
  }))
}

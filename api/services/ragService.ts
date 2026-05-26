interface PaperWithIndex {
  paper: {
    id: string
    title: string
    authors: string[]
    year: number
    abstract?: string
    source: string
    doi?: string
    journal?: string
    citationCount?: number
    keywords?: string[]
  }
  index: number
}

function computeRelevanceScore(paper: PaperWithIndex['paper'], query: string): number {
  const queryTerms = query.toLowerCase().split(/[\s,，。.、]+/).filter((t) => t.length > 1)
  if (queryTerms.length === 0) return 0

  const titleLower = paper.title.toLowerCase()
  const abstractLower = (paper.abstract || '').toLowerCase()
  const keywordsLower = (paper.keywords || []).join(' ').toLowerCase()

  let score = 0
  for (const term of queryTerms) {
    const titleMatches = (titleLower.match(new RegExp(term, 'g')) || []).length
    const abstractMatches = (abstractLower.match(new RegExp(term, 'g')) || []).length
    const keywordMatches = (keywordsLower.match(new RegExp(term, 'g')) || []).length

    score += titleMatches * 3 + keywordMatches * 2 + abstractMatches * 1
  }

  return score
}

export function selectRelevantPapers(
  papers: Array<PaperWithIndex['paper']>,
  sectionType: string,
  sectionTitle: string,
  topic: string,
  maxPapers: number = 15
): Array<PaperWithIndex['paper'] & { _originalIndex: number }> {
  if (papers.length <= maxPapers) {
    return papers.map((p, i) => ({ ...p, _originalIndex: i }))
  }

  const queryMap: Record<string, string> = {
    abstract: topic,
    introduction: topic,
    related_work: `${topic} literature review comparison`,
    literature_review: `${topic} literature review comparison`,
    methodology: `${topic} method approach framework`,
    method: `${topic} method approach framework`,
    findings: `${topic} results findings data`,
    results: `${topic} results findings data`,
    experiments: `${topic} experimental setup evaluation`,
    discussion: `${topic} implications interpretation`,
    limitations: `${topic} limitations constraints`,
    conclusion: `${topic} conclusion summary future`,
  }

  const query = `${queryMap[sectionType] || topic} ${sectionTitle} ${topic}`

  const scored = papers.map((paper, index) => ({
    paper: { ...paper, _originalIndex: index },
    score: computeRelevanceScore(paper, query),
  }))

  scored.sort((a, b) => b.score - a.score)

  const selected = scored.slice(0, maxPapers).map((s) => s.paper)
  selected.sort((a, b) => a._originalIndex - b._originalIndex)

  return selected
}

export function formatPaperEvidenceList(papers: Array<PaperWithIndex['paper'] & { _originalIndex?: number }>): string {
  return papers
    .map((paper, displayIndex) => {
      const originalIndex = '_originalIndex' in paper ? (paper as { _originalIndex: number })._originalIndex : displayIndex
      const citationNumber = originalIndex + 1
      const sourceType = paper.source.replace(/_/g, ' ')
      const doi = paper.doi ? ` DOI: ${paper.doi}.` : ''
      const journal = paper.journal ? ` ${paper.journal}.` : ''
      const citations = typeof paper.citationCount === 'number' ? ` Citations: ${paper.citationCount}.` : ''
      const abstract = paper.abstract ? `\nAbstract: ${paper.abstract}` : ''

      return `[${citationNumber}] ${paper.authors.join(', ')} (${paper.year}). ${paper.title}.${journal} Source: ${sourceType}.${doi}${citations}${abstract}`
    })
    .join('\n\n')
}

import type { Paper } from '../../shared/types.js'

export async function execute(papers: Paper[]): Promise<Paper[]> {
  return papers.map((paper) => ({
    ...paper,
    abstract: paper.abstract || 'Abstract not available for this paper.',
    authors: paper.authors.length > 0 ? paper.authors : ['Unknown Author'],
    keywords: paper.keywords || extractKeywords(paper),
  }))
}

function extractKeywords(paper: Paper): string[] {
  const text = `${paper.title} ${paper.abstract}`.toLowerCase()
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'this', 'that', 'these', 'those',
    'we', 'our', 'their', 'it', 'its', 'as', 'not', 'no', 'can', 'which',
    'based', 'using', 'used', 'use', 'also', 'such', 'more', 'than',
  ])

  const words = text.match(/[a-z]{3,}/g) || []
  const freq = new Map<string, number>()
  for (const w of words) {
    if (!commonWords.has(w)) {
      freq.set(w, (freq.get(w) || 0) + 1)
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
}

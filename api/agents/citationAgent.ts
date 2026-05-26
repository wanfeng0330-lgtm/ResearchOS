import { v4 as uuidv4 } from 'uuid'
import type { GeneratedSection, Paper, Reference, CitationFormat } from '../../shared/types.js'

export function cleanLatexFromContent(content: string): string {
  let result = content
  result = result.replace(/\\cite\{([^}]*)\}/g, (_, inner) => {
    const keys = inner.split(',').map((k: string) => k.trim())
    return keys.map(() => '[n]').join('')
  })
  result = result.replace(/\\textbf\{([^}]*)\}/g, '$1')
  result = result.replace(/\\textit\{([^}]*)\}/g, '$1')
  result = result.replace(/\\emph\{([^}]*)\}/g, '$1')
  result = result.replace(/\\ref\{([^}]*)\}/g, '$1')
  result = result.replace(/\\label\{([^}]*)\}/g, '')
  result = result.replace(/\\url\{([^}]*)\}/g, '$1')
  result = result.replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1')
  result = result.replace(/\\footnote\{([^}]*)\}/g, '$1')
  result = result.replace(/\\footnotetext\{([^}]*)\}/g, '$1')
  result = result.replace(/\\text\{([^}]*)\}/g, '$1')
  result = result.replace(/\\mathrm\{([^}]*)\}/g, '$1')
  result = result.replace(/\\texttt\{([^}]*)\}/g, '$1')
  result = result.replace(/\\underline\{([^}]*)\}/g, '$1')
  result = result.replace(/\\overline\{([^}]*)\}/g, '$1')
  result = result.replace(/\\title\{([^}]*)\}/g, '$1')
  result = result.replace(/\\author\{([^}]*)\}/g, '$1')
  result = result.replace(/\\section\{([^}]*)\}/g, '$1')
  result = result.replace(/\\subsection\{([^}]*)\}/g, '$1')
  result = result.replace(/\\subsubsection\{([^}]*)\}/g, '$1')
  result = result.replace(/\\paragraph\{([^}]*)\}/g, '$1')
  result = result.replace(/\\caption\{([^}]*)\}/g, '$1')
  result = result.replace(/\\begin\{[^}]*\}/g, '')
  result = result.replace(/\\end\{[^}]*\}/g, '')
  result = result.replace(/\\item/g, '- ')
  result = result.replace(/\\\\\s*/g, '\n')
  result = result.replace(/\\n/g, '\n')
  result = result.replace(/\\par\s*/g, '\n\n')
  result = result.replace(/\\newline\s*/g, '\n')
  result = result.replace(/\\linebreak\s*/g, '\n')
  result = result.replace(/\\pagebreak\s*/g, '')
  result = result.replace(/\\clearpage\s*/g, '')
  result = result.replace(/\\noindent\s*/g, '')
  result = result.replace(/\\indent\s*/g, '')
  result = result.replace(/\\centering\s*/g, '')
  result = result.replace(/\\raggedright\s*/g, '')
  result = result.replace(/\\raggedleft\s*/g, '')
  result = result.replace(/\\small\s*/g, '')
  result = result.replace(/\\large\s*/g, '')
  result = result.replace(/\\Large\s*/g, '')
  result = result.replace(/\\normalsize\s*/g, '')
  result = result.replace(/\\tiny\s*/g, '')
  result = result.replace(/\\scriptsize\s*/g, '')
  result = result.replace(/\\footnotesize\s*/g, '')
  result = result.replace(/\\huge\s*/g, '')
  result = result.replace(/\\Huge\s*/g, '')
  result = result.replace(/\\vspace\{[^}]*\}/g, '')
  result = result.replace(/\\hspace\{[^}]*\}/g, '')
  result = result.replace(/\\vfill\s*/g, '')
  result = result.replace(/\\hfill\s*/g, '')
  result = result.replace(/\\bigskip\s*/g, '')
  result = result.replace(/\\medskip\s*/g, '')
  result = result.replace(/\\smallskip\s*/g, '')
  result = result.replace(/\\~\\?/g, ' ')
  result = result.replace(/\\&/g, '&')
  result = result.replace(/\\%/g, '%')
  result = result.replace(/\\\$/g, '$')
  result = result.replace(/\\#/g, '#')
  result = result.replace(/\\_/g, '_')
  result = result.replace(/\\{/g, '{')
  result = result.replace(/\\}/g, '}')
  result = result.replace(/---/g, '-')
  result = result.replace(/--/g, '-')
  result = result.replace(/``/g, '"')
  result = result.replace(/''/g, '"')
  result = result.replace(/`([^']+)'/g, '"$1"')
  result = result.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
  result = result.replace(/\\[a-zA-Z]+/g, '')
  result = result.replace(/\{([^}]*)\}/g, '$1')
  result = result.replace(/\n{3,}/g, '\n\n')
  result = result.trim()
  return result
}

export async function execute(
  sections: GeneratedSection[],
  papers: Paper[],
  format: CitationFormat
): Promise<{ sections: GeneratedSection[]; references: Reference[] }> {
  const paperMap = new Map(papers.map((p) => [p.id, p]))

  const references: Reference[] = papers.map((paper) => {
    const id = uuidv4()

    return {
      id,
      paperId: paper.id,
      authors: paper.authors.join(', '),
      title: paper.title,
      year: paper.year,
      journal: paper.journal || '',
      doi: paper.doi,
      bibtex: paper.bibtex || generateBibtex(paper),
      apa: generateApa(paper),
      ieee: generateIeee(paper),
      gbt: generateGbt(paper),
    }
  })

  const refMap = new Map(references.map((r) => [r.paperId, r]))

  const updatedSections = sections.map((section) => {
    const updatedCitations = section.citations.map((citation) => {
      const ref = refMap.get(citation.paperId)
      const paper = paperMap.get(citation.paperId)

      if (ref && paper) {
        return { ...citation, format, text: `[${citation.position}]` }
      }

      return { ...citation, format, text: `[${citation.position}]` }
    })

    let content = section.content
    content = cleanLatexFromContent(content)

    return { ...section, content, citations: updatedCitations }
  })

  return { sections: updatedSections, references }
}

function generateBibtex(paper: Paper): string {
  const key = paper.sourceId || paper.id
  const journalPart = paper.journal ? `,\n  journal={${paper.journal}}` : ''
  const doiPart = paper.doi ? `,\n  doi={${paper.doi}}` : ''
  return `@article{${key},\n  title={${paper.title}},\n  author={${paper.authors.join(' and ')}},\n  year={${paper.year}}${journalPart}${doiPart}\n}`
}

function generateApa(paper: Paper): string {
  let authorPart: string
  if (paper.authors.length === 1) {
    authorPart = paper.authors[0]
  } else if (paper.authors.length === 2) {
    authorPart = `${paper.authors[0]} & ${paper.authors[1]}`
  } else {
    authorPart = `${paper.authors[0]}, ${paper.authors.slice(1, -1).join(', ')}, & ${paper.authors[paper.authors.length - 1]}`
  }
  const journalPart = paper.journal ? ` ${paper.journal}.` : ''
  const doiPart = paper.doi ? ` https://doi.org/${paper.doi}` : ''
  return `${authorPart} (${paper.year}). ${paper.title}.${journalPart}${doiPart}`
}

function generateIeee(paper: Paper): string {
  const initials = paper.authors.map((a) => {
    const parts = a.trim().split(' ')
    if (parts.length > 1) {
      const initials = parts.slice(0, -1).map((p) => `${p[0]}.`).join(' ')
      return `${initials} ${parts[parts.length - 1]}`
    }
    return a
  })
  const journalPart = paper.journal ? ` ${paper.journal},` : ''
  const doiPart = paper.doi ? ` doi: ${paper.doi}.` : '.'
  return `${initials.join(', ')}, "${paper.title},"${journalPart} ${paper.year}.${doiPart}`
}

function generateGbt(paper: Paper): string {
  const journalPart = paper.journal ? ` ${paper.journal},` : ''
  const doiPart = paper.doi ? ` DOI:${paper.doi}.` : '.'
  return `${paper.authors.join(', ')}. ${paper.year}. ${paper.title}.${journalPart}${doiPart}`
}

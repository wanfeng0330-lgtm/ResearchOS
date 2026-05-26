import type { GeneratedSection, Paper, Reference } from '../../shared/types.js'

export interface IntegrityIssue {
  severity: 'critical' | 'warning'
  category: 'citation' | 'evidence' | 'metadata' | 'required_statement'
  message: string
  sectionTitle?: string
}

export interface IntegrityReport {
  issues: IntegrityIssue[]
  summary: string
  passed: boolean
}

const REQUIRED_SECTION_SIGNALS = [
  { label: 'limitations', patterns: [/limitation/i, /局限|限制/] },
  { label: 'data availability', patterns: [/data availability/i, /数据可用|資料可用/] },
  { label: 'ethics declaration', patterns: [/ethics/i, /伦理|倫理/] },
  { label: 'conflict of interest', patterns: [/conflict of interest/i, /利益冲突|利益衝突/] },
  { label: 'funding acknowledgment', patterns: [/funding/i, /资助|資助|基金/] },
  { label: 'AI-use disclosure', patterns: [/AI[- ]?use|AI disclosure|artificial intelligence/i, /人工智能|AI工具|AI 使用/] },
]

export async function execute(
  sections: GeneratedSection[],
  papers: Paper[],
  references: Reference[]
): Promise<IntegrityReport> {
  const issues: IntegrityIssue[] = []
  const maxCitationNumber = papers.length
  const fullText = sections.map((section) => `${section.title}\n${section.content}`).join('\n\n')

  for (const section of sections) {
    const citationMatches = Array.from(section.content.matchAll(/\[(\d+)\]/g))
    for (const match of citationMatches) {
      const citationNumber = Number(match[1])
      if (!Number.isInteger(citationNumber) || citationNumber < 1 || citationNumber > maxCitationNumber) {
        issues.push({
          severity: 'critical',
          category: 'citation',
          sectionTitle: section.title,
          message: `Citation marker [${match[1]}] does not match any supplied paper.`,
        })
      }
    }

    const suspiciousClaims = section.content.match(/\b(p\s*[<=>]|effect size|sample size|dataset|randomized|causal|causality)\b/gi)
    if (suspiciousClaims && citationMatches.length === 0) {
      issues.push({
        severity: 'warning',
        category: 'evidence',
        sectionTitle: section.title,
        message: 'Section contains methodological or quantitative language but has no citation markers.',
      })
    }
  }

  for (const paper of papers) {
    if (paper.doi && !references.some((ref) => ref.paperId === paper.id && ref.doi === paper.doi)) {
      issues.push({
        severity: 'warning',
        category: 'metadata',
        message: `Reference metadata may have dropped DOI for "${paper.title}".`,
      })
    }

    const age = new Date().getFullYear() - paper.year
    if (age > 10 && (paper.relevanceScore || 0) > 0.3) {
      issues.push({
        severity: 'warning',
        category: 'evidence',
        message: `"${paper.title}" is older than 10 years; treat as seminal/contextual unless the field requires historical sources.`,
      })
    }
  }

  for (const signal of REQUIRED_SECTION_SIGNALS) {
    const found = signal.patterns.some((pattern) => pattern.test(fullText))
    if (!found) {
      issues.push({
        severity: 'warning',
        category: 'required_statement',
        message: `Missing or implicit required academic statement: ${signal.label}.`,
      })
    }
  }

  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length
  const summary = criticalCount > 0
    ? `Integrity audit found ${criticalCount} critical issue(s) and ${warningCount} warning(s).`
    : `Integrity audit passed with ${warningCount} warning(s).`

  return {
    issues,
    summary,
    passed: criticalCount === 0,
  }
}

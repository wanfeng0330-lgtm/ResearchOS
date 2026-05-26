import type { GeneratedSection, Reference, ChartDefinition } from '../../shared/types.js'

function addHeadingNumbersToContent(content: string, sectionIndex: number): string {
  let h2Counter = 0
  let h3Counter = 0

  const h3Count = (content.match(/^###\s+/gm) || []).length
  let processedContent = content
  if (h3Count > 0 && h3Count < 3) {
    processedContent = processedContent.replace(/^###\s+(.+)$/gm, '**$1**')
  }

  const h2Count = (processedContent.match(/^##\s+/gm) || []).length
  if (h2Count === 1) {
    processedContent = processedContent.replace(/^##\s+(.+)$/gm, '**$1**')
  }

  return processedContent.replace(/^(#{2,3})\s+(.+)$/gm, (match, hashes, text) => {
    const level = hashes.length
    if (level === 2) {
      h2Counter++
      h3Counter = 0
      return `${hashes} ${sectionIndex + 1}.${h2Counter} ${text}`
    }
    if (level === 3) {
      h3Counter++
      return `${hashes} ${sectionIndex + 1}.${h2Counter}.${h3Counter} ${text}`
    }
    return match
  })
}

function extractHeadings(content: string, sectionIndex: number): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = []
  let h2Counter = 0
  let h3Counter = 0

  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(/^(#{2,3})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      if (level === 2) {
        h2Counter++
        h3Counter = 0
        headings.push({ level: 2, text: `${sectionIndex + 1}.${h2Counter} ${match[2]}` })
      } else if (level === 3) {
        h3Counter++
        headings.push({ level: 3, text: `${sectionIndex + 1}.${h2Counter}.${h3Counter} ${match[2]}` })
      }
    }
  }
  return headings
}

export async function execute(
  sections: GeneratedSection[],
  references: Reference[],
  includeToc: boolean = true
): Promise<{ content: string; charts: string[] }> {
  const allCharts: ChartDefinition[] = []
  let figureNumber = 1

  const abstractSection = sections.find((s) => s.type === 'abstract')
  const bodySections = sections.filter((s) => s.type !== 'abstract')

  let content = ''

  if (abstractSection) {
    content += `摘要\n\n${abstractSection.content}\n\n`
  }

  if (includeToc) {
    content += `目录\n\n`
    bodySections.forEach((section, idx) => {
      content += `${idx + 1} ${section.title}\n`
      const headings = extractHeadings(section.content, idx)
      for (const heading of headings) {
        const indent = heading.level === 2 ? '  ' : '    '
        content += `${indent}${heading.text}\n`
      }
    })
    content += `${bodySections.length + 1} 参考文献\n\n`
  }

  const numberedSections = bodySections.map((section, idx) => {
    const sectionNumber = idx + 1
    const header = `## ${sectionNumber}. ${section.title}`

    let sectionContent = section.content
    sectionContent = addHeadingNumbersToContent(sectionContent, idx)

    sectionContent = sectionContent.replace(/^####\s+/gm, '#### ')

    if (section.charts && section.charts.length > 0) {
      for (const chart of section.charts) {
        const figureLabel = `图${figureNumber}`
        const figureCaption = `${figureLabel} ${chart.caption || chart.title}`
        sectionContent += `\n\n${figureCaption}`
        allCharts.push(chart)
        figureNumber++
      }
    }

    return `${header}\n\n${sectionContent}`
  })

  content += numberedSections.join('\n\n')

  content += `\n\n## ${bodySections.length + 1}. 参考文献\n\n`

  const referenceList = references
    .map((ref, index) => {
      return `[${index + 1}] ${ref.gbt || ref.apa}`
    })
    .join('\n')

  content += referenceList

  const chartDescriptions = allCharts.map((chart, i) => {
    return `图${i + 1}: ${chart.title} - ${chart.caption} (${chart.type})`
  })

  return { content, charts: chartDescriptions }
}

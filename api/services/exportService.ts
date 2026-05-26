import fs from 'fs'
import path from 'path'
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  LeaderType,
  TabStopType,
  TextRun,
  convertInchesToTwip,
} from 'docx'
import PDFDocument from 'pdfkit'
import type { ChartDefinition, GeneratedSection, Project, Reference } from '../../shared/types.js'

const EXPORTS_DIR = path.resolve(process.cwd(), 'exports')

const FONT_HEADING = 'SimHei'
const FONT_BODY = 'SimSun'
const SIZE_TITLE = 22
const SIZE_HEADING_1 = 16
const SIZE_HEADING_2 = 14
const SIZE_HEADING_3 = 12
const SIZE_BODY = 12
const SIZE_SMALL = 10.5

function ensureExportsDir(): void {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true })
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

function getAbstract(sections: GeneratedSection[], project: Project): string {
  const abstractSection = sections.find((section) => section.type === 'abstract' || section.title.includes('摘要'))
  if (abstractSection?.content) return abstractSection.content
  if (project.description) return project.description
  return sections[0]?.content.slice(0, 300) || ''
}

function getKeywords(project: Project): string[] {
  return project.keywords || []
}

function getSectionTitle(section: GeneratedSection, index: number): string {
  return `${index + 1} ${section.title}`
}

function buildReferenceText(reference: Reference, index: number): string {
  return `[${index + 1}] ${reference.gbt || reference.apa}`
}

interface ParsedBlock {
  type: 'heading' | 'paragraph'
  level?: number
  text: string
}

function parseContentWithHeadings(content: string): ParsedBlock[] {
  const lines = content.split('\n')
  const result: ParsedBlock[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      result.push({ type: 'heading', level, text: headingMatch[2] })
    } else {
      result.push({ type: 'paragraph', text: trimmed })
    }
  }

  return result
}

function addHeadingNumbers(
  blocks: ParsedBlock[],
  sectionIndex: number
): ParsedBlock[] {
  let h2Counter = 0
  let h3Counter = 0

  const h3Count = blocks.filter((b) => b.type === 'heading' && b.level === 3).length
  let normalizedBlocks = h3Count > 0 && h3Count < 3
    ? blocks.map((b) => b.type === 'heading' && b.level === 3 ? { ...b, type: 'paragraph' as const, level: undefined } : b)
    : blocks

  const h2Count = normalizedBlocks.filter((b) => b.type === 'heading' && b.level === 2).length
  if (h2Count === 1) {
    normalizedBlocks = normalizedBlocks.map((b) => b.type === 'heading' && b.level === 2 ? { ...b, type: 'paragraph' as const, level: undefined } : b)
  }

  return normalizedBlocks.map((block) => {
    if (block.type === 'heading' && block.level) {
      if (block.level === 2) {
        h2Counter++
        h3Counter = 0
        return { ...block, text: `${sectionIndex + 1}.${h2Counter} ${block.text}` }
      }
      if (block.level === 3) {
        h3Counter++
        return { ...block, text: `${sectionIndex + 1}.${h2Counter}.${h3Counter} ${block.text}` }
      }
      if (block.level === 4) {
        return block
      }
    }
    return block
  })
}

interface TocEntry {
  level: number
  text: string
}

function buildTocEntries(
  sections: GeneratedSection[]
): TocEntry[] {
  const entries: TocEntry[] = []
  const bodySections = sections.filter((s) => s.type !== 'abstract')

  for (let i = 0; i < bodySections.length; i++) {
    const section = bodySections[i]
    entries.push({ level: 1, text: getSectionTitle(section, i) })

    const parsedContent = parseContentWithHeadings(section.content)
    const numberedContent = addHeadingNumbers(parsedContent, i)

    for (const block of numberedContent) {
      if (block.type === 'heading' && block.level && (block.level === 2 || block.level === 3)) {
        entries.push({ level: block.level, text: block.text })
      }
    }
  }

  entries.push({ level: 1, text: `${bodySections.length + 1} 参考文献` })
  return entries
}

function buildManualTocDocx(tocEntries: TocEntry[]): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const tabStopRight = convertInchesToTwip(6)

  for (const entry of tocEntries) {
    const indentLeft = entry.level === 1 ? 0 : entry.level === 2 ? 360 : 720
    const fontSize = entry.level === 1 ? SIZE_BODY : entry.level === 2 ? SIZE_SMALL : SIZE_SMALL
    const isBold = entry.level === 1

    paragraphs.push(new Paragraph({
      spacing: { before: entry.level === 1 ? 120 : 40, after: 40 },
      indent: { left: indentLeft },
      tabStops: [{ type: TabStopType.RIGHT, position: tabStopRight, leader: LeaderType.DOT }],
      children: [
        new TextRun({
          text: entry.text,
          font: FONT_BODY,
          size: fontSize * 2,
          bold: isBold,
        }),
        new TextRun({ text: '\t', font: FONT_BODY, size: fontSize * 2 }),
      ],
    }))
  }

  return paragraphs
}

async function buildChartBlocksForDocx(charts: ChartDefinition[]): Promise<Paragraph[]> {
  const blocks: Paragraph[] = []

  for (let i = 0; i < charts.length; i++) {
    const chart = charts[i]
    const imageUrl = typeof chart.data?.imageUrl === 'string' ? chart.data.imageUrl : ''
    const imageBuffer = imageUrl ? await fetchImageBuffer(imageUrl) : null

    if (imageBuffer) {
      blocks.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 160, after: 80 },
        children: [new ImageRun({ data: imageBuffer, type: 'png', transformation: { width: 480, height: 280 } })],
      }))
    }

    blocks.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: `图${i + 1} ${chart.caption || chart.title}`,
          font: FONT_BODY,
          size: SIZE_SMALL * 2,
        }),
      ],
    }))
  }

  return blocks
}

function buildParagraphWithSuperscriptCitations(text: string, font: string, size: number): Paragraph {
  const parts = text.split(/(\[\d+\])/g)
  const children: TextRun[] = []

  for (const part of parts) {
    if (/^\[\d+\]$/.test(part)) {
      children.push(new TextRun({
        text: part,
        font,
        size: size * 2,
        superScript: true,
      }))
    } else if (part) {
      children.push(new TextRun({
        text: part,
        font,
        size: size * 2,
      }))
    }
  }

  return new Paragraph({
    spacing: { line: 360, after: 120 },
    indent: { firstLine: 480 },
    children,
  })
}

function findSystemFont(candidates: string[]): string | null {
  const searchPaths = [
    'C:/Windows/Fonts/',
    '/usr/share/fonts/',
    '/usr/local/share/fonts/',
    '/System/Library/Fonts/',
  ]
  for (const candidate of candidates) {
    if (candidate.endsWith('.ttc')) continue
    for (const searchPath of searchPaths) {
      const fullPath = path.join(searchPath, candidate)
      if (fs.existsSync(fullPath)) return fullPath
    }
  }
  return null
}

export async function generateDocx(
  sections: GeneratedSection[],
  references: Reference[],
  charts: ChartDefinition[],
  project: Project,
  includeToc: boolean = true
): Promise<string> {
  ensureExportsDir()

  const abstract = getAbstract(sections, project)
  const keywords = getKeywords(project)
  const margin = {
    top: convertInchesToTwip(1),
    bottom: convertInchesToTwip(1),
    left: convertInchesToTwip(1.25),
    right: convertInchesToTwip(1.25),
  }

  const titleAndAbstractChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 240 },
      children: [new TextRun({ text: project.title, font: FONT_HEADING, size: SIZE_TITLE * 2, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 160 },
      children: [new TextRun({ text: '摘 要', font: FONT_HEADING, size: SIZE_HEADING_1 * 2, bold: true })],
    }),
    new Paragraph({
      spacing: { line: 360, after: 160 },
      indent: { firstLine: 480 },
      children: [new TextRun({ text: abstract, font: FONT_BODY, size: SIZE_BODY * 2 })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({ text: '关键词：', font: FONT_HEADING, size: SIZE_BODY * 2, bold: true }),
        new TextRun({ text: keywords.join('；'), font: FONT_BODY, size: SIZE_BODY * 2 }),
      ],
    }),
  ]

  if (includeToc) {
    titleAndAbstractChildren.push(new Paragraph({ children: [new PageBreak()] }))
    titleAndAbstractChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 180 },
      children: [new TextRun({ text: '目 录', font: FONT_HEADING, size: SIZE_HEADING_1 * 2, bold: true })],
    }))
    const tocEntries = buildTocEntries(sections)
    titleAndAbstractChildren.push(...buildManualTocDocx(tocEntries))
  }

  const bodyChildren: Paragraph[] = []
  const bodySections = sections.filter((section) => section.type !== 'abstract')

  for (let i = 0; i < bodySections.length; i++) {
    const section = bodySections[i]
    bodyChildren.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: getSectionTitle(section, i), font: FONT_HEADING, size: SIZE_HEADING_1 * 2, bold: true })],
    }))

    const parsedContent = parseContentWithHeadings(section.content)
    const numberedContent = addHeadingNumbers(parsedContent, i)

    for (const block of numberedContent) {
      if (block.type === 'heading' && block.level) {
        const headingLevel = block.level <= 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
        const headingSize = block.level <= 2 ? SIZE_HEADING_2 : SIZE_HEADING_3
        bodyChildren.push(new Paragraph({
          heading: headingLevel,
          spacing: { before: 160, after: 80 },
          children: [new TextRun({ text: block.text, font: FONT_HEADING, size: headingSize * 2, bold: true })],
        }))
      } else {
        bodyChildren.push(buildParagraphWithSuperscriptCitations(block.text, FONT_BODY, SIZE_BODY))
      }
    }

    if (section.charts?.length) {
      bodyChildren.push(...await buildChartBlocksForDocx(section.charts))
    }
  }

  bodyChildren.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: `${bodySections.length + 1} 参考文献`, font: FONT_HEADING, size: SIZE_HEADING_1 * 2, bold: true })],
  }))

  for (let i = 0; i < references.length; i++) {
    bodyChildren.push(new Paragraph({
      spacing: { line: 320, after: 80 },
      children: [new TextRun({ text: buildReferenceText(references[i], i), font: FONT_BODY, size: SIZE_SMALL * 2 })],
    }))
  }

  if (charts.length > 0 && bodySections.every((section) => !section.charts?.length)) {
    bodyChildren.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: '图表附录', font: FONT_HEADING, size: SIZE_HEADING_1 * 2, bold: true })],
    }))
    bodyChildren.push(...await buildChartBlocksForDocx(charts))
  }

  const docSections = [
    {
      properties: { page: { margin } },
      children: titleAndAbstractChildren,
    },
    {
      properties: { page: { margin, pageNumbers: { start: 1 } } },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: project.title, font: FONT_BODY, size: SIZE_SMALL * 2 })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT_BODY, size: SIZE_SMALL * 2 })],
          })],
        }),
      },
      children: bodyChildren,
    },
  ]

  const doc = new Document({
    sections: docSections,
  })

  const buffer = await Packer.toBuffer(doc)
  const fileName = `${project.id}-${Date.now()}.docx`
  const filePath = path.join(EXPORTS_DIR, fileName)
  fs.writeFileSync(filePath, buffer)
  return filePath
}

export async function generatePdf(
  sections: GeneratedSection[],
  references: Reference[],
  charts: ChartDefinition[],
  project: Project,
  includeToc: boolean = true
): Promise<string> {
  ensureExportsDir()
  const fileName = `${project.id}-${Date.now()}.pdf`
  const filePath = path.join(EXPORTS_DIR, fileName)

  const simheiPath = findSystemFont(['simhei.ttf', 'SimHei.ttf'])
  const bodyFontPath = findSystemFont(['simfang.ttf', 'simkai.ttf', 'simsunb.ttf', 'SimFang.ttf', 'SimKai.ttf'])
  const hasSimHei = simheiPath !== null
  const hasBodyFont = bodyFontPath !== null
  const headingFont = hasSimHei ? 'SimHei' : 'Helvetica-Bold'
  const bodyFont = hasBodyFont ? 'BodyFont' : 'Helvetica'
  const abstract = getAbstract(sections, project)
  const keywords = getKeywords(project)

  const pageMargin = 72

  const doc = new PDFDocument({ bufferPages: true, margin: pageMargin, size: 'A4' })
  const stream = fs.createWriteStream(filePath)
  doc.pipe(stream)

  if (hasSimHei && simheiPath) doc.registerFont('SimHei', simheiPath)
  if (hasBodyFont && bodyFontPath) doc.registerFont('BodyFont', bodyFontPath)

  const contentWidth = doc.page.width - pageMargin * 2

  doc.font(headingFont).fontSize(22).text(project.title, pageMargin, undefined, { align: 'center', width: contentWidth })
  doc.moveDown(0.8)
  doc.font(headingFont).fontSize(14).text('摘 要', pageMargin, undefined, { align: 'center', width: contentWidth })
  doc.moveDown(0.5)
  doc.font(bodyFont).fontSize(12).text(abstract, pageMargin, undefined, { lineGap: 6, indent: 24, width: contentWidth })
  doc.moveDown(0.5)
  doc.font(headingFont).fontSize(12).text('关键词：', pageMargin, undefined, { continued: true, width: contentWidth })
  doc.font(bodyFont).text(keywords.join('；'))

  if (includeToc) {
    doc.addPage()
    doc.font(headingFont).fontSize(14).text('目 录', pageMargin, undefined, { align: 'center', width: contentWidth })
    doc.moveDown(0.8)

    const tocEntries = buildTocEntries(sections)
    for (const entry of tocEntries) {
      const indent = entry.level === 1 ? 0 : entry.level === 2 ? 20 : 40
      const fontSize = entry.level === 1 ? 12 : entry.level === 2 ? 11 : 10
      doc.font(bodyFont).fontSize(fontSize).text(entry.text, pageMargin + indent, undefined, { lineGap: 4, width: contentWidth - indent })
      doc.moveDown(0.15)
    }
  }

  const bodySections = sections.filter((section) => section.type !== 'abstract')
  for (let i = 0; i < bodySections.length; i++) {
    const section = bodySections[i]
    doc.addPage()
    doc.font(headingFont).fontSize(16).text(getSectionTitle(section, i), pageMargin, undefined, { align: 'center', width: contentWidth })
    doc.moveDown(0.5)

    const parsedContent = parseContentWithHeadings(section.content)
    const numberedContent = addHeadingNumbers(parsedContent, i)

    for (const block of numberedContent) {
      if (block.type === 'heading' && block.level) {
        const headingSize = block.level <= 2 ? 14 : 12
        const headingIndent = block.level === 2 ? 0 : block.level === 3 ? 12 : 24
        doc.font(headingFont).fontSize(headingSize).text(block.text, pageMargin + headingIndent, undefined, { width: contentWidth - headingIndent })
        doc.moveDown(0.3)
      } else {
        doc.font(bodyFont).fontSize(12).text(block.text, pageMargin, undefined, { lineGap: 6, indent: 24, width: contentWidth })
        doc.moveDown(0.3)
      }
    }

    if (section.charts?.length) {
      for (let j = 0; j < section.charts.length; j++) {
        const chart = section.charts[j]
        const imageUrl = typeof chart.data?.imageUrl === 'string' ? chart.data.imageUrl : ''
        const imageBuffer = imageUrl ? await fetchImageBuffer(imageUrl) : null
        if (imageBuffer) {
          doc.moveDown(0.6)
          doc.image(imageBuffer, { fit: [420, 240], align: 'center' })
          doc.moveDown(0.4)
        }
        doc.font(bodyFont).fontSize(10.5).text(`图${j + 1} ${chart.caption || chart.title}`, pageMargin, undefined, { align: 'center', width: contentWidth })
      }
    }
  }

  doc.addPage()
  doc.font(headingFont).fontSize(16).text(`${bodySections.length + 1} 参考文献`, pageMargin, undefined, { align: 'center', width: contentWidth })
  doc.moveDown(0.6)
  for (let i = 0; i < references.length; i++) {
    doc.font(bodyFont).fontSize(10.5).text(buildReferenceText(references[i], i), pageMargin, undefined, { lineGap: 4, width: contentWidth })
    doc.moveDown(0.2)
  }

  if (charts.length > 0 && bodySections.every((section) => !section.charts?.length)) {
    doc.addPage()
    doc.font(headingFont).fontSize(16).text('图表附录', pageMargin, undefined, { align: 'center', width: contentWidth })
    for (let i = 0; i < charts.length; i++) {
      const chart = charts[i]
      const imageUrl = typeof chart.data?.imageUrl === 'string' ? chart.data.imageUrl : ''
      const imageBuffer = imageUrl ? await fetchImageBuffer(imageUrl) : null
      if (imageBuffer) {
        doc.moveDown(0.6)
        doc.image(imageBuffer, { fit: [420, 240], align: 'center' })
      }
      doc.moveDown(0.4)
      doc.font(bodyFont).fontSize(10.5).text(`图${i + 1} ${chart.caption || chart.title}`, pageMargin, undefined, { align: 'center', width: contentWidth })
    }
  }

  const pageRange = doc.bufferedPageRange()
  for (let i = 1; i < pageRange.count; i++) {
    doc.switchToPage(i)
    doc.font(bodyFont).fontSize(9).text(project.title, 72, 30, { align: 'center', width: doc.page.width - 144 })
    doc.font(bodyFont).fontSize(9).text(String(i), 72, doc.page.height - 45, { align: 'center', width: doc.page.width - 144 })
  }

  doc.end()
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath))
    stream.on('error', reject)
  })
}

export function generateLatex(
  sections: GeneratedSection[],
  references: Reference[],
  charts: ChartDefinition[],
  project: Project,
  includeToc: boolean = true
): string {
  const abstract = getAbstract(sections, project)
  const keywords = getKeywords(project)
  const bodySections = sections.filter((section) => section.type !== 'abstract')

  let latex = `\\documentclass[12pt,a4paper]{ctexart}
\\usepackage{fontspec}
\\usepackage{graphicx}
\\usepackage{geometry}
\\geometry{left=3cm,right=2.5cm,top=2.5cm,bottom=2.5cm}
\\setmainfont{Times New Roman}
\\setCJKmainfont{SimSun}
\\setCJKfamilyfont{heiti}{SimHei}
\\title{${escapeLatex(project.title)}}
\\date{${new Date().toLocaleDateString('zh-CN')}}
\\begin{document}
\\maketitle
\\begin{abstract}
${escapeLatex(abstract)}

\\textbf{关键词：}${escapeLatex(keywords.join('；'))}
\\end{abstract}
`

  if (includeToc) {
    latex += `\\tableofcontents\n\\newpage\n`
  }

  for (let i = 0; i < bodySections.length; i++) {
    const section = bodySections[i]
    latex += `\\section{${escapeLatex(getSectionTitle(section, i))}}\n`

    const parsedContent = parseContentWithHeadings(section.content)
    const numberedContent = addHeadingNumbers(parsedContent, i)

    for (const block of numberedContent) {
      if (block.type === 'heading' && block.level) {
        if (block.level <= 2) {
          latex += `\\subsection{${escapeLatex(block.text)}}\n`
        } else {
          latex += `\\subsubsection{${escapeLatex(block.text)}}\n`
        }
      } else {
        latex += `${escapeLatex(block.text)}\n\n`
      }
    }

    if (section.charts?.length) {
      for (let j = 0; j < section.charts.length; j++) {
        const chart = section.charts[j]
        const imageUrl = typeof chart.data?.imageUrl === 'string' ? chart.data.imageUrl : ''
        if (imageUrl) {
          latex += `\\begin{figure}[h]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{${imageUrl}}\n\\caption{${escapeLatex(`图${j + 1} ${chart.caption || chart.title}`)}}\n\\end{figure}\n`
        }
      }
    }
  }

  latex += `\\section{${escapeLatex(`${bodySections.length + 1} 参考文献`)}}\n\\begin{thebibliography}{99}\n`
  for (let i = 0; i < references.length; i++) {
    latex += `\\bibitem{ref${i + 1}} ${escapeLatex(buildReferenceText(references[i], i))}\n`
  }
  latex += `\\end{thebibliography}\n`

  if (charts.length > 0 && bodySections.every((section) => !section.charts?.length)) {
    latex += `\\section{图表附录}\n`
    for (let i = 0; i < charts.length; i++) {
      const chart = charts[i]
      const imageUrl = typeof chart.data?.imageUrl === 'string' ? chart.data.imageUrl : ''
      if (imageUrl) {
        latex += `\\begin{figure}[h]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{${imageUrl}}\n\\caption{${escapeLatex(`图${i + 1} ${chart.caption || chart.title}`)}}\n\\end{figure}\n`
      }
    }
  }

  latex += '\\end{document}\n'
  return latex
}

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\$/g, '\\$')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

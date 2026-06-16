import path from 'path'
import fs from 'fs'
import { Router, type Request, type Response } from 'express'
import * as projectService from '../services/projectService.js'
import * as exportService from '../services/exportService.js'
import type { ExportFormat, CitationFormat } from '../../shared/types.js'

const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { projectId, format, citationFormat, includeCharts, includeToc } = req.body as {
    projectId: string
    format: ExportFormat
    citationFormat: CitationFormat
    includeCharts?: boolean
    includeToc?: boolean
  }

  if (!projectId || !format || !citationFormat) {
    res.status(400).json({
      success: false,
      error: 'projectId, format, and citationFormat are required',
    })
    return
  }

  const project = await projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }

  const sections = await projectService.getGeneratedSections(projectId)
  const references = await projectService.getReferences(projectId)
  const allCharts = sections.flatMap(s => s.charts || [])
  const charts = includeCharts === false ? [] : allCharts
  const exportSections = includeCharts === false
    ? sections.map((section) => ({ ...section, charts: [] }))
    : sections
  const toc = includeToc !== undefined ? includeToc : true

  if (sections.length === 0) {
    res.status(400).json({ success: false, error: 'No generated content to export' })
    return
  }

  const exportJob = await projectService.createExportJob(projectId, format, citationFormat)

  try {
    let filePath: string | undefined

    switch (format) {
      case 'docx':
        filePath = await exportService.generateDocx(exportSections, references, charts, project, toc)
        break
      case 'pdf':
        filePath = await exportService.generatePdf(exportSections, references, charts, project, toc)
        break
      case 'latex': {
        const latexContent = exportService.generateLatex(exportSections, references, charts, project, toc)
        const exportsDir = path.resolve(process.cwd(), 'exports')
        if (!fs.existsSync(exportsDir)) {
          fs.mkdirSync(exportsDir, { recursive: true })
        }
        const latexFileName = `${project.id}-${Date.now()}.tex`
        filePath = path.join(exportsDir, latexFileName)
        fs.writeFileSync(filePath, latexContent)
        break
      }
      case 'typst':
        res.status(400).json({
          success: false,
          error: 'Typst format is not yet supported. Please use docx, pdf, or latex.',
        })
        return
    }

    const fileName = filePath ? path.basename(filePath) : undefined

    await projectService.updateExportJob(exportJob.id, {
      status: 'completed',
      downloadUrl: `/api/export/${exportJob.id}/download`,
      fileName,
    })

    res.json({
      success: true,
      data: {
        jobId: exportJob.id,
        format,
        citationFormat,
        fileName,
        downloadUrl: `/api/export/${exportJob.id}/download`,
        status: 'completed',
      },
    })
  } catch (error) {
    await projectService.updateExportJob(exportJob.id, {
      status: 'failed',
    })
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    })
  }
})

router.get('/:jobId/download', async (req: Request, res: Response): Promise<void> => {
  const job = await projectService.getExportJob(req.params.jobId)

  if (!job) {
    res.status(404).json({ success: false, error: 'Export job not found' })
    return
  }

  if (job.status !== 'completed' || !job.fileName) {
    res.status(400).json({ success: false, error: 'Export not ready or failed' })
    return
  }

  const exportsDir = path.resolve(process.cwd(), 'exports')
  const filePath = path.join(exportsDir, job.fileName)

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: 'File not found' })
    return
  }

  const mimeType = getMimeType(job.format)
  res.setHeader('Content-Type', mimeType)
  res.setHeader('Content-Disposition', `attachment; filename="${job.fileName}"`)
  fs.createReadStream(filePath).pipe(res)
})

function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'pdf':
      return 'application/pdf'
    case 'latex':
      return 'text/x-latex'
    case 'typst':
      return 'text/plain'
    default:
      return 'application/octet-stream'
  }
}

export default router

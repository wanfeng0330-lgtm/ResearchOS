import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import multer from 'multer'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import projectRoutes from './routes/projects.js'
import searchRoutes from './routes/search.js'
import generateRoutes from './routes/generate.js'
import generateStepsRoutes from './routes/generateSteps.js'
import exportRoutes from './routes/export.js'
import workspaceRoutes from './routes/workspaces.js'
import knowledgeBaseRoutes from './routes/knowledgeBase.js'
import citationChainRoutes from './routes/citationChain.js'
import workflowRoutes from './routes/workflow.js'
import streamRoutes, { broadcastToProject } from './routes/stream.js'

export { broadcastToProject }

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

const uploadsDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop() || 'png'
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

app.use('/uploads', express.static(uploadsDir))

app.post('/api/upload/image', upload.single('image'), (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' })
    return
  }
  const url = `/uploads/${req.file.filename}`
  res.json({ success: true, data: { url, filename: req.file.filename } })
})

app.use('/api/projects', projectRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/generate', generateRoutes)
app.use('/api/generate/step', generateStepsRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/workspaces', workspaceRoutes)
app.use('/api/projects/:projectId/knowledge-base', knowledgeBaseRoutes)
app.use('/api/projects/:projectId/citation-chain', citationChainRoutes)
app.use('/api/projects/:projectId/workflow', workflowRoutes)
app.use('/api/stream', streamRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', error)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app

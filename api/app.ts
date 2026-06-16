import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import swaggerUi from 'swagger-ui-express'
import projectRoutes from './routes/projects.js'
import searchRoutes from './routes/search.js'
import generateRoutes from './routes/generate.js'
import generateStepsRoutes from './routes/generateSteps.js'
import exportRoutes from './routes/export.js'
import workspaceRoutes from './routes/workspaces.js'
import knowledgeBaseRoutes from './routes/knowledgeBase.js'
import citationChainRoutes from './routes/citationChain.js'
import workflowRoutes from './routes/workflow.js'
import authRoutes from './routes/auth.js'
import streamRoutes, { broadcastToProject } from './routes/stream.js'
import { SUPABASE_ENABLED } from './db/supabaseClient.js'

export { broadcastToProject }

const app: express.Application = express()

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

// CORS - allow frontend origin
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3001',
]
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    // In production, reject unknown origins; in dev, allow all
    if (process.env.NODE_ENV === 'production') {
      return callback(new Error('Not allowed by CORS'))
    }
    callback(null, true)
  },
  credentials: true,
}))

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many authentication attempts' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/', apiLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)

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

// Swagger API docs
try {
  const openapiPath = join(process.cwd(), 'api', 'docs', 'openapi.json')
  if (existsSync(openapiPath)) {
    const openapiDoc = JSON.parse(readFileSync(openapiPath, 'utf-8'))
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'ResearchFlow API Documentation',
    }))
  }
} catch { /* swagger setup failed silently */ }

// Auth routes
app.use('/api/auth', authRoutes)

// Protected and public routes
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

// Health check with dependency status
app.get('/api/health', async (_req: Request, res: Response): Promise<void> => {
  const health: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: { enabled: SUPABASE_ENABLED, status: 'unknown' },
  }

  if (SUPABASE_ENABLED) {
    try {
      const { supabase } = await import('./db/supabaseClient.js')
      const { error } = await supabase.from('workspaces').select('id').limit(1)
      health.database = { enabled: true, status: error ? 'error' : 'connected' }
    } catch {
      health.database = { enabled: true, status: 'disconnected' }
      health.status = 'degraded'
    }
  } else {
    health.database = { enabled: false, status: 'disabled (using in-memory)' }
  }

  const statusCode = (health.status === 'ok' || process.env.NODE_ENV !== 'production') ? 200 : 503
  res.status(statusCode).json({ success: true, data: health })
})

// Error handling
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => { // eslint-disable-line @typescript-eslint/no-unused-vars
  console.error('Unhandled error:', error)
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `API not found: ${req.method} ${req.path}`,
  })
})

export default app

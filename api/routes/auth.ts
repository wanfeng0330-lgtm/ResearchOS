import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import * as authService from '../services/authService.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().max(100).optional(),
})

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
})

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0].message })
    return
  }
  try {
    const user = await authService.register(parsed.data.email, parsed.data.password, parsed.data.name)
    res.status(201).json({ success: true, data: user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed'
    const status = message === 'Email already registered' ? 409 : 400
    res.status(status).json({ success: false, error: message })
  }
})

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0].message })
    return
  }
  try {
    const result = await authService.login(parsed.data.email, parsed.data.password)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    })
  }
})

router.post('/logout', async (_req: Request, res: Response): Promise<void> => {
  res.json({ success: true, message: 'Logged out' })
})

router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await authService.getUserById(req.user!.id)
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }
    res.json({ success: true, data: user })
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get user info' })
  }
})

export default router

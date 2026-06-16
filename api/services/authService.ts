import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { DB_ENABLED } from '../db/index.js'
import { userRepo } from '../db/repository.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const BCRYPT_ROUNDS = 10

// In-memory fallback
interface UserRecord {
  id: string
  email: string
  passwordHash: string
  name: string
  role: 'user' | 'premium'
  createdAt: string
  updatedAt: string
}

const users = new Map<string, UserRecord>()

export async function register(email: string, password: string, name?: string): Promise<{ id: string; email: string; name: string; role: string }> {
  if (!email || !password) {
    throw new Error('Email and password are required')
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  if (DB_ENABLED) {
    const existing = await userRepo.findByEmail(email)
    if (existing) throw new Error('Email already registered')
    const user = await userRepo.create({ email, passwordHash, name: name || '' })
    return { id: user.id, email: user.email, name: user.name, role: user.role }
  }

  // In-memory fallback
  const existing = Array.from(users.values()).find(u => u.email === email)
  if (existing) throw new Error('Email already registered')

  const id = uuidv4()
  const now = new Date().toISOString()
  const user: UserRecord = { id, email, passwordHash, name: name || '', role: 'user', createdAt: now, updatedAt: now }
  users.set(id, user)
  return { id, email, name: user.name, role: user.role }
}

export async function login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string; name: string; role: string } }> {
  if (!email || !password) {
    throw new Error('Email and password are required')
  }

  let user: { id: string; email: string; passwordHash: string; name: string; role: string } | null = null

  if (DB_ENABLED) {
    const dbUser = await userRepo.findByEmail(email)
    if (!dbUser) throw new Error('Invalid email or password')
    user = dbUser
  } else {
    const memUser = Array.from(users.values()).find(u => u.email === email)
    if (!memUser) throw new Error('Invalid email or password')
    user = memUser
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new Error('Invalid email or password')

  const payload = { id: user.id, email: user.email, role: user.role }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  }
}

export async function getUserById(id: string): Promise<{ id: string; email: string; name: string; role: string } | null> {
  if (DB_ENABLED) {
    const user = await userRepo.findById(id)
    if (!user) return null
    return { id: user.id, email: user.email, name: user.name, role: user.role }
  }

  const user = users.get(id)
  if (!user) return null
  return { id: user.id, email: user.email, name: user.name, role: user.role }
}

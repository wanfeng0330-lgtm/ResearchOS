import type { Config } from 'drizzle-kit'

export default {
  schema: './api/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/researchflow',
    ssl: (process.env.DATABASE_URL || '').includes('supabase') ? { rejectUnauthorized: false } : undefined,
  },
} satisfies Config

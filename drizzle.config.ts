import type { Config } from 'drizzle-kit'

export default {
  schema: './api/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/researchflow',
  },
} satisfies Config

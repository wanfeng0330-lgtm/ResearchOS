import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const DB_ENABLED = process.env.DB_ENABLED !== 'false'

let client: any
let db: any

if (DB_ENABLED) {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/researchflow'
  const isSupabase = connectionString.includes('supabase')
  client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20000,
    connect_timeout: 10000,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  })
  db = drizzle(client, { schema })
} else {
  console.log('[DB] Database disabled, using in-memory storage')
  // Create mock client and db for disabled mode
  client = {
    end: async () => console.log('[DB] Mock client closed')
  }
  db = {
    execute: async (query: any) => {
      console.log('[DB] Mock execute:', query?.sql || 'unknown query')
      return []
    },
    select: () => ({
      from: () => ({
        where: () => ({
          execute: async () => []
        })
      })
    }),
    insert: () => ({
      values: () => ({
        returning: () => ({
          execute: async () => []
        })
      })
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => ({
            execute: async () => []
          })
        })
      })
    }),
    delete: () => ({
      where: () => ({
        execute: async () => []
      })
    })
  }
}

export { db, client, DB_ENABLED }
export default db

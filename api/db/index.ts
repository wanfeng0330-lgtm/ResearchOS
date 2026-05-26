import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/researchflow'

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20000,
  connect_timeout: 10000,
})

export const db = drizzle(client, { schema })
export { client }
export default db

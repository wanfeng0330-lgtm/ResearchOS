import { supabase, SUPABASE_ENABLED } from './supabaseClient.js'

export async function initializeDatabase(): Promise<void> {
  if (!SUPABASE_ENABLED) {
    console.log('[DB] Supabase REST API not configured, using in-memory storage')
    return
  }

  console.log('[DB] Initializing Supabase REST API connection...')

  try {
    // Verify connection by querying the workspaces table
    const { data, error } = await supabase.from('workspaces').select('id').limit(1)

    if (error) {
      console.error('[DB] Supabase connection error:', error.message)
      console.error('[DB] Will use in-memory fallback')
      return
    }

    // Check all required tables by trying to query each one
    const tables = ['users', 'workspaces', 'projects', 'papers', 'knowledge_entries', 'generated_sections', 'paper_references', 'workflow_states', 'export_jobs', 'paper_embeddings']
    const results = await Promise.allSettled(
      tables.map(t => supabase.from(t).select('id').limit(1))
    )
    const accessible = results.filter(r => r.status === 'fulfilled').length
    console.log(`[DB] Supabase REST API connected! ${accessible}/${tables.length} tables accessible`)
  } catch (error) {
    console.error('[DB] Initialization error:', (error as Error).message)
    console.error('[DB] Will use in-memory fallback')
  }
}

export async function closeDatabase(): Promise<void> {
  console.log('[DB] Supabase REST API - no connection to close (stateless)')
}

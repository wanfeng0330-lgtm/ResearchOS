import { sql } from 'drizzle-orm'
import db, { client } from './index.js'

export async function initializeDatabase(): Promise<void> {
  console.log('[DB] Initializing database...')

  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
    console.log('[DB] uuid-ossp extension ensured')

    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "vector"`)
    console.log('[DB] vector extension ensured')

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        topic TEXT NOT NULL,
        description TEXT DEFAULT '',
        status VARCHAR(50) DEFAULT 'draft',
        language VARCHAR(10) DEFAULT 'en',
        total_word_count INT DEFAULT 5000,
        paper_type VARCHAR(50) DEFAULT 'graduation',
        citation_format VARCHAR(50) DEFAULT 'apa',
        keywords JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id)`)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS papers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        authors JSONB DEFAULT '[]',
        year INT,
        abstract TEXT,
        source TEXT NOT NULL,
        source_id TEXT,
        pdf_url TEXT,
        citation_count INT DEFAULT 0,
        keywords JSONB DEFAULT '[]',
        bibtex TEXT,
        doi TEXT,
        journal TEXT,
        selected BOOLEAN DEFAULT false,
        relevance_score REAL DEFAULT 0,
        tags JSONB DEFAULT '[]',
        notes TEXT DEFAULT '',
        summary TEXT,
        citation_number INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_papers_project ON papers(project_id)`)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS knowledge_entries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        source_paper_ids JSONB DEFAULT '[]',
        section_type VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_entries(project_id)`)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS generated_sections (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        citations JSONB DEFAULT '[]',
        section_order INT NOT NULL,
        word_count INT DEFAULT 0,
        charts JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sections_project ON generated_sections(project_id)`)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS references (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        paper_id UUID REFERENCES papers(id),
        bibtex TEXT,
        apa TEXT,
        ieee TEXT,
        gbt TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_references_project ON references(project_id)`)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workflow_states (
        project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        current_stage VARCHAR(100),
        completed_stages JSONB DEFAULT '[]',
        failed_stage VARCHAR(100),
        stage_history JSONB DEFAULT '[]',
        can_resume BOOLEAN DEFAULT false,
        progress JSONB DEFAULT '{}',
        started_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS export_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        format VARCHAR(50) NOT NULL,
        citation_format VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        file_path TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS paper_embeddings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
        chunk_text TEXT NOT NULL,
        embedding vector(1536),
        chunk_index INT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_embeddings_paper ON paper_embeddings(paper_id)`)

    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON paper_embeddings
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
      `)
    } catch {
      console.log('[DB] IVFFlat index skipped (needs data first, will create later)')
    }

    console.log('[DB] All tables created successfully')
  } catch (error) {
    console.error('[DB] Initialization error:', (error as Error).message)
    console.error('[DB] Database will use in-memory fallback')
  }
}

export async function closeDatabase(): Promise<void> {
  await client.end()
  console.log('[DB] Connection closed')
}

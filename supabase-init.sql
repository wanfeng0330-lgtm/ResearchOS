CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  total_word_count INTEGER DEFAULT 5000,
  paper_type VARCHAR(50) DEFAULT 'graduation',
  citation_format VARCHAR(50) DEFAULT 'apa',
  keywords JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);

CREATE TABLE IF NOT EXISTS papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors JSONB DEFAULT '[]',
  year INTEGER,
  abstract TEXT,
  source TEXT NOT NULL,
  source_id TEXT,
  pdf_url TEXT,
  citation_count INTEGER DEFAULT 0,
  keywords JSONB DEFAULT '[]',
  bibtex TEXT,
  doi TEXT,
  journal TEXT,
  selected BOOLEAN DEFAULT FALSE,
  relevance_score REAL DEFAULT 0,
  tags JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  summary TEXT,
  citation_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_papers_project ON papers(project_id);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  source_paper_ids JSONB DEFAULT '[]',
  section_type VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_entries(project_id);

CREATE TABLE IF NOT EXISTS generated_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  section_order INTEGER NOT NULL,
  word_count INTEGER DEFAULT 0,
  charts JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sections_project ON generated_sections(project_id);

CREATE TABLE IF NOT EXISTS paper_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  paper_id UUID REFERENCES papers(id),
  bibtex TEXT,
  apa TEXT,
  ieee TEXT,
  gbt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_references_project ON paper_references(project_id);

CREATE TABLE IF NOT EXISTS workflow_states (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  current_stage VARCHAR(100),
  completed_stages JSONB DEFAULT '[]',
  failed_stage VARCHAR(100),
  stage_history JSONB DEFAULT '[]',
  can_resume BOOLEAN DEFAULT FALSE,
  progress JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  format VARCHAR(50) NOT NULL,
  citation_format VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_paper ON paper_embeddings(paper_id);

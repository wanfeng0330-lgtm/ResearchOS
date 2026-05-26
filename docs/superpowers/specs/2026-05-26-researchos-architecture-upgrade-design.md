# ResearchOS Architecture Upgrade Design

## Overview

Upgrade ResearchFlow from "AI Paper Generator" to "AI Research Workflow Platform (ResearchOS)" through incremental refactoring.

**Approach**: Architecture-First, three phases

**Principles**:
- Maximize reuse of existing code, database, and agents
- Maintain existing API compatibility
- Never break current functionality
- Incremental, not rewrite

---

## Current State Diagnosis

### Performance: 15-20 min generation time

| Root Cause | Location | Impact |
|---|---|---|
| Orchestrator fully serial | orchestrator.ts:472 | 10 stages run sequentially |
| LLM concurrency limit = 2 | semaphore.ts:35 | Writing 8 sections queued |
| Word count fix triggers extra LLM calls | writingAgent.ts:160-240 | 1-2 extra calls per section |
| AIGC reduction uses heavy model | aigcReductionAgent.ts | Should use lightweight model |
| Image generation serial | chartAgent.ts | 5-15s per image, sequential |
| Search queries serial | searchAgent.ts:17 | 4 queries run sequentially |

### Cache: Near-zero hit rate

| Root Cause | Location | Impact |
|---|---|---|
| Cache key includes full prompt with literature | llmCache.ts:13-20 | Different key every time |
| System prompt dynamically assembled each call | writingAgent.ts:115-138 | 5 protocols + type + rules = different each time |
| Literature list injected in full each time | ragService.ts:78-91 | Abstracts included, order varies |
| Pure in-memory cache, lost on restart | llmCache.ts:9 | No persistence |
| LRU capacity only 500 entries | llmCache.ts:11 | One generation uses 20+ entries |

### Architecture Gaps

| Gap | Description |
|---|---|
| No persistence | Pure in-memory Map storage |
| No Workspace concept | Only Project, no workspace/KB/citation chain |
| No async task queue | Fire-and-forget, no retry/cancel/resume |
| No streaming | HTTP polling at 2s interval |
| API keys hardcoded | chartAgent.ts SiliconFlow key in source |
| RAG is keyword matching | ragService.ts pure regex word frequency |

---

## Phase 1: Architecture Skeleton

### 1.1 Data Model

```
Workspace (工作台)
  id, name, description, createdAt, updatedAt
  ├── Projects[] (科研项目)
  │   id, workspaceId, title, topic, description, status, config
  │   language, totalWordCount, paperType, citationFormat
  │   createdAt, updatedAt
  │   │
  │   ├── PaperLibrary (文献库)
  │   │   papers[]        - id, title, authors, year, abstract, source,
  │   │                     sourceId, pdfUrl, citationCount, keywords,
  │   │                     bibtex, doi, journal, selected, relevanceScore,
  │   │                     tags[], notes, summary (cached)
  │   │   citations[]     - id, paperId, sectionId, format, text, position
  │   │
  │   ├── KnowledgeBase (知识库)
  │   │   viewpoints[]    - id, content, sourcePaperIds[], sectionType,
  │   │                     createdAt
  │   │   summaries[]     - id, paperId, content, createdAt (文献总结缓存)
  │   │   embeddings[]    - id, paperId, chunkText, chunkIndex (引用, Phase 3)
  │   │
  │   ├── WritingPipeline (写作管线)
  │   │   sectionConfig[]     - type, title, enabled, wordCount, order
  │   │   generatedSections[] - id, type, title, content, citations[],
  │   │                          order, wordCount, charts[]
  │   │   references[]        - id, bibtex, apa, ieee, gbt
  │   │
  │   └── WorkflowState (工作流状态)
  │       currentStage       - AgentStage
  │       stageHistory[]     - { stage, status, startedAt, completedAt, error }
  │       canResume          - boolean
  │       taskQueue[]        - { id, type, status, result }
  │       progress           - { stage, progress, message, partialContent }
  │
  └── Settings
      defaultCitationFormat, defaultLanguage, defaultPaperType
```

### 1.2 Service Layer

```
api/services/
├── workspaceService.ts      # Workspace CRUD
├── projectService.ts        # Project CRUD (existing, refactored to delegate)
├── knowledgeBaseService.ts  # Knowledge base management
├── paperLibraryService.ts   # Paper library management
├── citationChainService.ts  # Citation chain management
├── workflowEngine.ts        # Workflow engine (NEW - core)
├── taskQueueService.ts      # Async task queue
├── llmService.ts            # Existing, keep
├── llmCache.ts              # Existing, keep
├── ragService.ts            # Existing, keep
├── searchService.ts         # Existing, keep
├── exportService.ts         # Existing, keep
├── imageService.ts          # Existing, keep
└── semaphore.ts             # Existing, keep
```

**projectService.ts refactoring strategy**:
- Keep all existing function signatures unchanged
- Internally delegate to new specialized services
- Add new functions for Workspace/KB/CitationChain
- Zero breaking changes for existing callers

### 1.3 Workflow Engine

The core new component that replaces the hardcoded serial pipeline in orchestrator.ts.

```typescript
interface WorkflowStage {
  name: string
  agent: string
  dependencies: string[]
  parallelizable: boolean
  retryable: boolean
  timeout: number
}

interface WorkflowDefinition {
  stages: WorkflowStage[]
  transitions: Record<string, string[]>
}

interface WorkflowState {
  projectId: string
  currentStage: string
  completedStages: string[]
  failedStage: string | null
  stageResults: Record<string, any>
  canResume: boolean
  startedAt: string
  updatedAt: string
}
```

**Default workflow (paper generation)**:

```
keyword_extracting ──┬→ section_planning ──────────────┐
                      └→ searching → parsing → extracting┼→ writing → citing ──┬→ integrity_reviewing ──┐
                                                                           ├→ aigc_detecting ───────┼→ formatting
                                                                           └→ charting ────────────┘
```

**Parallel opportunities**:
1. `section_planning` || `searching` (both depend only on `keyword_extracting`)
2. `integrity_reviewing` || `aigc_detecting` || `charting` (all depend on `citing`)
3. `writingAgent` internal section parallelism (increase Semaphore to 4-6)

**Key features**:
- `canResume`: Any stage failure allows resuming from breakpoint
- `stageHistory`: Full audit trail of workflow execution
- `taskQueue`: Async task management with status tracking
- Workflow definition separated from execution engine
- Future: support custom workflows

### 1.4 API Design

**Existing APIs (unchanged)**:
```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
POST   /api/search
POST   /api/generate/related-work
GET    /api/generate/progress/:id
POST   /api/export
```

**New APIs**:
```
# Workspace
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:id
PUT    /api/workspaces/:id
DELETE /api/workspaces/:id

# Workspace -> Projects
GET    /api/workspaces/:id/projects
POST   /api/workspaces/:id/projects

# Knowledge Base
GET    /api/projects/:id/knowledge-base
POST   /api/projects/:id/knowledge-base/summarize     # Generate literature summaries
GET    /api/projects/:id/knowledge-base/viewpoints

# Citation Chain
GET    /api/projects/:id/citation-chain
POST   /api/projects/:id/citation-chain/link
DELETE /api/projects/:id/citation-chain/link/:linkId

# Workflow
GET    /api/projects/:id/workflow
POST   /api/projects/:id/workflow/resume
POST   /api/projects/:id/workflow/cancel
```

### 1.5 Frontend Pages

```
/                            → Workspace Dashboard (upgrade Home)
/workspace/:id               → Workspace detail (NEW)
/project/:id                 → Project detail (existing, extended)
/project/:id/knowledge-base  → Knowledge base (NEW)
/library                     → Global library (existing)
/export/:id                  → Export (existing)
```

### 1.6 Shared Types Additions

Add to `shared/types.ts`:

```typescript
interface Workspace {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  settings: WorkspaceSettings
}

interface WorkspaceSettings {
  defaultCitationFormat: CitationFormat
  defaultLanguage: 'en' | 'zh'
  defaultPaperType: PaperType
}

interface KnowledgeEntry {
  id: string
  projectId: string
  type: 'viewpoint' | 'summary' | 'note'
  content: string
  sourcePaperIds: string[]
  sectionType?: string
  createdAt: string
}

interface CitationChainLink {
  id: string
  projectId: string
  paperId: string
  sectionId: string
  context: string
  createdAt: string
}

interface WorkflowStageResult {
  stage: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startedAt?: string
  completedAt?: string
  error?: string
}

interface WorkflowState {
  projectId: string
  currentStage: string
  completedStages: string[]
  failedStage: string | null
  stageHistory: WorkflowStageResult[]
  canResume: boolean
  startedAt: string
  updatedAt: string
}
```

---

## Phase 2: Performance Optimization

### 2.1 LLM Three-Tier Architecture

```
Tier 1 (Heavy): token-plan API
  - writingAgent (section writing)
  - extractAgent (viewpoint extraction)
  - sectionPlanner (section planning)
  Base URL: https://token-plan-cn.xiaomimimo.com/v1
  Key: tp-ci2x114db83216h0pc55349zw5dwad05q0lz6jvhrpel5kpw

Tier 2 (Medium): DeepSeek API
  - citationAgent (formatting)
  - aigcReductionAgent (rewriting)
  - keywordAgent (keyword extraction)
  Base URL: https://api.deepseek.com

Tier 3 (Light): Volcengine API
  - keywordAgent (fallback)
  - integrityAgent (rule supplement)
  Base URL: https://ark.cn-beijing.volces.com/api/v3
```

Implementation in `llmService.ts`:

```typescript
type LLMTier = 'heavy' | 'medium' | 'light'

interface TierConfig {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
}

const TIER_CONFIGS: Record<LLMTier, TierConfig> = {
  heavy: {
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    apiKey: process.env.TOKEN_PLAN_API_KEY || '',
    model: 'deepseek-v4-pro',
    maxTokens: 8192,
    temperature: 0.7,
    timeout: 300000,
  },
  medium: {
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: 'deepseek-v4-pro',
    maxTokens: 4096,
    temperature: 0.5,
    timeout: 180000,
  },
  light: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: process.env.VOLCENGINE_API_KEY || '',
    model: 'deepseek-v3-2-251201',
    maxTokens: 2048,
    temperature: 0.3,
    timeout: 120000,
  },
}

async function callTieredLLM(
  prompt: string,
  systemPrompt?: string,
  tier: LLMTier = 'medium',
  options?: LLMOptions
): Promise<string>
```

### 2.2 Agent Parallelization

Based on Workflow Engine dependency graph:

**Stage-level parallelism**:
- `section_planning` || `searching` (both depend on `keyword_extracting`)
- `integrity_reviewing` || `aigc_detecting` || `charting` (all depend on `citing`)

**Section-level parallelism**:
- Increase Semaphore from 2 to 4-6
- writingAgent already uses Promise.all, just needs higher concurrency

**Search-level parallelism**:
- searchAgent currently runs 4 queries sequentially
- Change to Promise.all with per-query error handling

### 2.3 Prompt Stabilization

**Current problem**: System prompt is dynamically assembled each call, making cache keys unstable.

**Solution**: Separate fixed and dynamic parts.

```typescript
// Fixed part (cached, reused across sections)
const FIXED_PROMPT_COMPONENTS = {
  protocol: ACADEMIC_RESEARCH_PROTOCOL,
  sourceQuality: SOURCE_QUALITY_PROTOCOL,
  writingQuality: WRITING_QUALITY_PROTOCOL,
  claimIntegrity: CLAIM_INTEGRITY_PROTOCOL,
  aigcReduction: AIGC_REDUCTION_PROTOCOL,
}

// Dynamic part (varies per section, but structured)
interface SectionContext {
  sectionType: string
  sectionTitle: string
  wordCountTarget: number
  citationFormat: CitationFormat
  language: 'en' | 'zh'
  paperType: PaperType
}

// Cache key = hash(fixedComponents) + hash(sectionContext) + hash(paperListHash)
// paperListHash = hash of paper IDs (not full abstracts)
```

### 2.4 Cache Layer Upgrade

**L1: Memory cache (improved)**
- Cache key uses hash of fixed prompt + structured context + paper ID list hash
- Capacity increased to 2000 entries
- TTL 24h

**L2: File cache (new)**
- Path: `.cache/llm/{hash}.json`
- Persists across restarts
- TTL 7 days
- Lazy cleanup on read

**L3: Redis cache (Phase 3)**

### 2.5 Literature Summary Cache

```typescript
interface PaperSummary {
  paperId: string
  summary: string
  keyFindings: string[]
  methodology: string
  generatedAt: string
  model: string
}
```

- Each paper summarized once, cached in KnowledgeBase
- Subsequent sections reuse summary instead of full abstract
- Reduces prompt size by ~60% for writing stage

### 2.6 Fixed Citation Numbering

- Assign fixed citation numbers when papers are added to project
- Numbers persist regardless of RAG selection order
- Ensures cache key stability for writing prompts

### 2.7 Expected Performance Improvement

```
Current:  ~16 minutes
After Phase 2: ~5-8 minutes

Breakdown:
- keyword + section_plan + search (parallel): ~25s (was ~55s)
- parse + extract: ~80s (unchanged)
- writing (4-6 concurrent, no word count fix): ~200s (was ~600s)
- citing: ~30s (unchanged)
- integrity + aigc + chart (parallel): ~60s (was ~185s)
- formatting: ~5s (unchanged)
Total: ~400s ≈ 7 minutes
```

---

## Phase 3: Infrastructure Upgrade

### 3.1 PostgreSQL + Drizzle ORM

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  config JSONB DEFAULT '{}',
  language TEXT DEFAULT 'en',
  total_word_count INT DEFAULT 5000,
  paper_type TEXT DEFAULT 'graduation',
  citation_format TEXT DEFAULT 'apa',
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors TEXT[] DEFAULT '{}',
  year INT,
  abstract TEXT,
  source TEXT NOT NULL,
  source_id TEXT,
  pdf_url TEXT,
  citation_count INT DEFAULT 0,
  keywords TEXT[] DEFAULT '{}',
  bibtex TEXT,
  doi TEXT,
  journal TEXT,
  selected BOOLEAN DEFAULT false,
  relevance_score FLOAT DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  summary TEXT,
  citation_number INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  source_paper_ids UUID[] DEFAULT '{}',
  section_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE generated_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  section_order INT NOT NULL,
  word_count INT DEFAULT 0,
  charts JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  paper_id UUID REFERENCES papers(id),
  bibtex TEXT,
  apa TEXT,
  ieee TEXT,
  gbt TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workflow_states (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  current_stage TEXT,
  completed_stages TEXT[] DEFAULT '{}',
  failed_stage TEXT,
  stage_history JSONB DEFAULT '[]',
  can_resume BOOLEAN DEFAULT false,
  progress JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  citation_format TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE paper_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),
  chunk_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_papers_project ON papers(project_id);
CREATE INDEX idx_sections_project ON generated_sections(project_id);
CREATE INDEX idx_workflow_project ON workflow_states(project_id);
CREATE INDEX idx_embeddings_paper ON paper_embeddings(paper_id);
CREATE INDEX ON paper_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 3.2 Redis Integration

```
Key patterns:
- llm:cache:{hash}           → LLM response cache (TTL: 24h)
- project:{id}:progress      → Generation progress (TTL: 1h)
- project:{id}:lock          → Distributed lock for concurrent generation (TTL: 30min)
- workspace:{id}:stats       → Workspace statistics (TTL: 5min)
- paper:summary:{sourceId}   → Paper summary cache (TTL: 7d)
- search:results:{queryHash} → Search results cache (TTL: 1h)
```

### 3.3 Streaming Output

**SSE (Server-Sent Events) approach** (simpler than WebSocket for this use case):

```
GET /api/generate/stream/:projectId
Content-Type: text/event-stream

event: progress
data: {"stage":"writing","progress":55,"message":"Writing: Introduction (2/8)"}

event: section
data: {"type":"introduction","title":"Introduction","content":"..."}

event: complete
data: {"status":"completed","totalWords":5200}
```

### 3.4 RAG Vector Search

Replace keyword matching in ragService.ts with pgvector similarity search:

```typescript
async function vectorSearch(
  query: string,
  projectId: string,
  sectionType: string,
  maxPapers: number = 15
): Promise<Paper[]> {
  const queryEmbedding = await generateEmbedding(query)
  // SQL: SELECT * FROM paper_embeddings
  //      WHERE paper_id IN (SELECT id FROM papers WHERE project_id = $1)
  //      ORDER BY embedding <=> $2
  //      LIMIT $3
}
```

---

## Evolution Roadmap

```
Phase 1 (Architecture Skeleton) - ~2 weeks
├── 1.1 Add Workspace/KB/CitationChain types to shared/types.ts
├── 1.2 Create workspaceService.ts / knowledgeBaseService.ts / citationChainService.ts
├── 1.3 Create workflowEngine.ts (replace orchestrator.ts hardcoded logic)
├── 1.4 Refactor projectService.ts to delegate pattern (keep all existing signatures)
├── 1.5 Add Workspace API routes
├── 1.6 Add Workspace Dashboard frontend page
└── 1.7 All existing functionality remains compatible

Phase 2 (Performance Optimization) - ~2 weeks
├── 2.1 Add callTieredLLM to llmService.ts (three-tier LLM)
├── 2.2 Implement parallel execution in workflowEngine.ts
├── 2.3 Increase Semaphore to 4-6
├── 2.4 Prompt stabilization + Cache key optimization
├── 2.5 Add file cache layer
├── 2.6 Literature summary caching
├── 2.7 Fixed citation numbering
└── 2.8 Expected: generation time from 15-20min to 5-8min

Phase 3 (Infrastructure) - ~2 weeks
├── 3.1 Introduce PostgreSQL + Drizzle ORM
├── 3.2 Data migration: in-memory Map → PostgreSQL
├── 3.3 Introduce Redis
├── 3.4 LLM Cache migration to Redis
├── 3.5 pgvector vector search replaces keyword matching
├── 3.6 SSE streaming output
└── 3.7 Expected: complete ResearchOS platform
```

## Constraints

- Never delete existing functions, only extend
- Never change existing API signatures, only add new endpoints
- All new services must work with in-memory storage first (Phase 1-2)
- Database migration only in Phase 3
- API keys must move to environment variables (chartAgent.ts fix)
- typst export bug must be fixed (currently generates LaTeX content)

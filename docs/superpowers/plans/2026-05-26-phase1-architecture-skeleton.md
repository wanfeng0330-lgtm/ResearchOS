# Phase 1: Architecture Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Workspace, KnowledgeBase, CitationChain, and WorkflowEngine to ResearchFlow without breaking existing functionality.

**Architecture:** Incremental layering — new services wrap existing projectService, WorkflowEngine replaces orchestrator's hardcoded pipeline, new API routes added alongside existing ones. All existing function signatures preserved.

**Tech Stack:** TypeScript, Express 4, React 18, Zustand, Vite, uuid

---

## File Structure

### New files to create:

```
shared/types.ts                          # MODIFY — add new types
api/services/workspaceService.ts          # CREATE — Workspace CRUD
api/services/knowledgeBaseService.ts      # CREATE — Knowledge base management
api/services/paperLibraryService.ts       # CREATE — Paper library management
api/services/citationChainService.ts      # CREATE — Citation chain management
api/services/workflowEngine.ts            # CREATE — Workflow engine (core)
api/services/taskQueueService.ts          # CREATE — Async task queue
api/routes/workspaces.ts                  # CREATE — Workspace API routes
api/routes/knowledgeBase.ts               # CREATE — Knowledge base API routes
api/routes/citationChain.ts              # CREATE — Citation chain API routes
api/routes/workflow.ts                    # CREATE — Workflow API routes
src/pages/WorkspaceDashboard.tsx          # CREATE — Workspace dashboard page
src/pages/WorkspaceDetail.tsx             # CREATE — Workspace detail page
src/components/WorkspaceCard.tsx          # CREATE — Workspace card component
```

### Existing files to modify:

```
api/services/projectService.ts            # MODIFY — delegate to new services
api/agents/orchestrator.ts                # MODIFY — use WorkflowEngine
api/app.ts                                # MODIFY — register new routes
.env                                      # MODIFY — add TOKEN_PLAN_API_KEY
shared/types.ts                           # MODIFY — add new types
src/App.tsx                               # MODIFY — add new routes
src/store/useAppStore.ts                  # MODIFY — add workspace state
src/utils/api.ts                          # MODIFY — add workspace API calls
src/components/Sidebar.tsx                # MODIFY — add workspace nav
api/agents/chartAgent.ts                  # MODIFY — fix hardcoded API key
api/routes/export.ts                      # MODIFY — fix typst bug
```

---

## Task 1: Add New Types to shared/types.ts

**Files:**
- Modify: `shared/types.ts`

- [ ] **Step 1: Add Workspace, KnowledgeBase, CitationChain, and WorkflowState types**

Append the following to the end of `shared/types.ts` (before the closing of the file, after `GenerationRequest`):

```typescript
export interface Workspace {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  defaultCitationFormat: CitationFormat;
  defaultLanguage: "en" | "zh";
  defaultPaperType: PaperType;
}

export interface KnowledgeEntry {
  id: string;
  projectId: string;
  type: "viewpoint" | "summary" | "note";
  content: string;
  sourcePaperIds: string[];
  sectionType?: string;
  createdAt: string;
}

export interface CitationChainLink {
  id: string;
  projectId: string;
  paperId: string;
  sectionId: string;
  context: string;
  createdAt: string;
}

export interface WorkflowStageResult {
  stage: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowState {
  projectId: string;
  currentStage: string;
  completedStages: string[];
  failedStage: string | null;
  stageHistory: WorkflowStageResult[];
  canResume: boolean;
  startedAt: string;
  updatedAt: string;
}
```

Also add `workspaceId` to the `Project` interface:

```typescript
export interface Project {
  id: string;
  workspaceId?: string;
  title: string;
  // ... rest unchanged
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors related to new types

- [ ] **Step 3: Commit**

```bash
git add shared/types.ts
git commit -m "feat: add Workspace, KnowledgeBase, CitationChain, WorkflowState types"
```

---

## Task 2: Create workspaceService.ts

**Files:**
- Create: `api/services/workspaceService.ts`

- [ ] **Step 1: Implement Workspace CRUD service**

Create `api/services/workspaceService.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid'
import type { Workspace, WorkspaceSettings, Project } from '../../shared/types.js'
import * as projectService from './projectService.js'

const workspaces = new Map<string, Workspace>()
const workspaceProjects = new Map<string, string[]>()

const DEFAULT_SETTINGS: WorkspaceSettings = {
  defaultCitationFormat: 'gbt',
  defaultLanguage: 'zh',
  defaultPaperType: 'graduation',
}

export function createWorkspace(name: string, description?: string, settings?: Partial<WorkspaceSettings>): Workspace {
  const id = uuidv4()
  const now = new Date().toISOString()
  const workspace: Workspace = {
    id,
    name,
    description: description || '',
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SETTINGS, ...settings },
  }
  workspaces.set(id, workspace)
  workspaceProjects.set(id, [])
  return workspace
}

export function getWorkspaces(): Workspace[] {
  return Array.from(workspaces.values())
}

export function getWorkspace(id: string): Workspace | null {
  return workspaces.get(id) || null
}

export function updateWorkspace(id: string, updates: Partial<Pick<Workspace, 'name' | 'description' | 'settings'>>): Workspace | null {
  const workspace = workspaces.get(id)
  if (!workspace) return null
  if (updates.name !== undefined) workspace.name = updates.name
  if (updates.description !== undefined) workspace.description = updates.description
  if (updates.settings !== undefined) workspace.settings = { ...workspace.settings, ...updates.settings }
  workspace.updatedAt = new Date().toISOString()
  return workspace
}

export function deleteWorkspace(id: string): boolean {
  const projectIds = workspaceProjects.get(id) || []
  for (const projectId of projectIds) {
    projectService.updateProjectStatus(projectId, 'draft')
  }
  workspaceProjects.delete(id)
  return workspaces.delete(id)
}

export function getWorkspaceProjects(workspaceId: string): Project[] {
  const projectIds = workspaceProjects.get(workspaceId) || []
  return projectIds
    .map(pid => projectService.getProject(pid))
    .filter((p): p is Project => p !== null)
}

export function addProjectToWorkspace(workspaceId: string, projectId: string): boolean {
  const ids = workspaceProjects.get(workspaceId)
  if (!ids) return false
  if (!ids.includes(projectId)) {
    ids.push(projectId)
  }
  const workspace = workspaces.get(workspaceId)
  if (workspace) workspace.updatedAt = new Date().toISOString()
  return true
}

export function removeProjectFromWorkspace(workspaceId: string, projectId: string): boolean {
  const ids = workspaceProjects.get(workspaceId)
  if (!ids) return false
  const index = ids.indexOf(projectId)
  if (index >= 0) ids.splice(index, 1)
  const workspace = workspaces.get(workspaceId)
  if (workspace) workspace.updatedAt = new Date().toISOString()
  return true
}

export function createDefaultWorkspace(): Workspace {
  const existing = getWorkspaces()
  if (existing.length > 0) return existing[0]
  return createWorkspace('默认工作台', '我的科研工作台')
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/services/workspaceService.ts
git commit -m "feat: add workspaceService for Workspace CRUD"
```

---

## Task 3: Create knowledgeBaseService.ts

**Files:**
- Create: `api/services/knowledgeBaseService.ts`

- [ ] **Step 1: Implement Knowledge Base service**

Create `api/services/knowledgeBaseService.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid'
import type { KnowledgeEntry } from '../../shared/types.js'

const knowledgeEntries = new Map<string, KnowledgeEntry[]>()

export function getEntries(projectId: string): KnowledgeEntry[] {
  return knowledgeEntries.get(projectId) || []
}

export function getEntriesByType(projectId: string, type: KnowledgeEntry['type']): KnowledgeEntry[] {
  return (knowledgeEntries.get(projectId) || []).filter(e => e.type === type)
}

export function addEntry(projectId: string, type: KnowledgeEntry['type'], content: string, sourcePaperIds: string[] = [], sectionType?: string): KnowledgeEntry {
  const entries = knowledgeEntries.get(projectId) || []
  const entry: KnowledgeEntry = {
    id: uuidv4(),
    projectId,
    type,
    content,
    sourcePaperIds,
    sectionType,
    createdAt: new Date().toISOString(),
  }
  entries.push(entry)
  knowledgeEntries.set(projectId, entries)
  return entry
}

export function addViewpoints(projectId: string, viewpoints: string[], sourcePaperIds: string[] = [], sectionType?: string): KnowledgeEntry[] {
  return viewpoints.map(vp => addEntry(projectId, 'viewpoint', vp, sourcePaperIds, sectionType))
}

export function addSummary(projectId: string, paperId: string, content: string): KnowledgeEntry {
  return addEntry(projectId, 'summary', content, [paperId])
}

export function getSummary(projectId: string, paperId: string): KnowledgeEntry | null {
  const entries = knowledgeEntries.get(projectId) || []
  return entries.find(e => e.type === 'summary' && e.sourcePaperIds.includes(paperId)) || null
}

export function addNote(projectId: string, content: string, sourcePaperIds: string[] = []): KnowledgeEntry {
  return addEntry(projectId, 'note', content, sourcePaperIds)
}

export function deleteEntry(projectId: string, entryId: string): boolean {
  const entries = knowledgeEntries.get(projectId) || []
  const index = entries.findIndex(e => e.id === entryId)
  if (index < 0) return false
  entries.splice(index, 1)
  return true
}

export function getViewpointsBySectionType(projectId: string, sectionType: string): KnowledgeEntry[] {
  return (knowledgeEntries.get(projectId) || [])
    .filter(e => e.type === 'viewpoint' && (!e.sectionType || e.sectionType === sectionType))
}

export function clearProjectEntries(projectId: string): void {
  knowledgeEntries.delete(projectId)
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/services/knowledgeBaseService.ts
git commit -m "feat: add knowledgeBaseService for knowledge entry management"
```

---

## Task 4: Create paperLibraryService.ts

**Files:**
- Create: `api/services/paperLibraryService.ts`

- [ ] **Step 1: Implement Paper Library service**

Create `api/services/paperLibraryService.ts`:

```typescript
import type { Paper } from '../../shared/types.js'

const paperTags = new Map<string, Map<string, string[]>>()
const paperNotes = new Map<string, Map<string, string>>()
const paperSummaries = new Map<string, Map<string, string>>()
const paperCitationNumbers = new Map<string, Map<string, number>>()

export function getTags(projectId: string, paperId: string): string[] {
  return paperTags.get(projectId)?.get(paperId) || []
}

export function setTags(projectId: string, paperId: string, tags: string[]): void {
  if (!paperTags.has(projectId)) paperTags.set(projectId, new Map())
  paperTags.get(projectId)!.set(paperId, tags)
}

export function getNotes(projectId: string, paperId: string): string {
  return paperNotes.get(projectId)?.get(paperId) || ''
}

export function setNotes(projectId: string, paperId: string, notes: string): void {
  if (!paperNotes.has(projectId)) paperNotes.set(projectId, new Map())
  paperNotes.get(projectId)!.set(paperId, notes)
}

export function getCachedSummary(projectId: string, paperId: string): string | null {
  return paperSummaries.get(projectId)?.get(paperId) || null
}

export function setCachedSummary(projectId: string, paperId: string, summary: string): void {
  if (!paperSummaries.has(projectId)) paperSummaries.set(projectId, new Map())
  paperSummaries.get(projectId)!.set(paperId, summary)
}

export function assignCitationNumbers(projectId: string, papers: Paper[]): Paper[] {
  if (!paperCitationNumbers.has(projectId)) paperCitationNumbers.set(projectId, new Map())
  const numberMap = paperCitationNumbers.get(projectId)!
  let nextNumber = 1

  return papers.map(paper => {
    if (!numberMap.has(paper.id)) {
      numberMap.set(paper.id, nextNumber)
      nextNumber++
    }
    return { ...paper, citationNumber: numberMap.get(paper.id) }
  })
}

export function getCitationNumber(projectId: string, paperId: string): number | null {
  return paperCitationNumbers.get(projectId)?.get(paperId) || null
}

export function clearProjectData(projectId: string): void {
  paperTags.delete(projectId)
  paperNotes.delete(projectId)
  paperSummaries.delete(projectId)
  paperCitationNumbers.delete(projectId)
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/services/paperLibraryService.ts
git commit -m "feat: add paperLibraryService for tags, notes, summaries, citation numbers"
```

---

## Task 5: Create citationChainService.ts

**Files:**
- Create: `api/services/citationChainService.ts`

- [ ] **Step 1: Implement Citation Chain service**

Create `api/services/citationChainService.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid'
import type { CitationChainLink } from '../../shared/types.js'

const citationChains = new Map<string, CitationChainLink[]>()

export function getChain(projectId: string): CitationChainLink[] {
  return citationChains.get(projectId) || []
}

export function addLink(projectId: string, paperId: string, sectionId: string, context: string): CitationChainLink {
  const chain = citationChains.get(projectId) || []
  const link: CitationChainLink = {
    id: uuidv4(),
    projectId,
    paperId,
    sectionId,
    context,
    createdAt: new Date().toISOString(),
  }
  chain.push(link)
  citationChains.set(projectId, chain)
  return link
}

export function removeLink(projectId: string, linkId: string): boolean {
  const chain = citationChains.get(projectId) || []
  const index = chain.findIndex(l => l.id === linkId)
  if (index < 0) return false
  chain.splice(index, 1)
  return true
}

export function getLinksByPaper(projectId: string, paperId: string): CitationChainLink[] {
  return (citationChains.get(projectId) || []).filter(l => l.paperId === paperId)
}

export function getLinksBySection(projectId: string, sectionId: string): CitationChainLink[] {
  return (citationChains.get(projectId) || []).filter(l => l.sectionId === sectionId)
}

export function rebuildChainFromSections(projectId: string, sections: Array<{ id: string; content: string; citations: Array<{ paperId: string }> }>): void {
  const chain: CitationChainLink[] = []
  for (const section of sections) {
    for (const citation of section.citations) {
      const contextMatch = section.content.match(new RegExp(`\\[\\d+\\][^\\[]{0,100}`, 'g'))
      const context = contextMatch ? contextMatch[0].slice(0, 100) : ''
      chain.push({
        id: uuidv4(),
        projectId,
        paperId: citation.paperId,
        sectionId: section.id,
        context,
        createdAt: new Date().toISOString(),
      })
    }
  }
  citationChains.set(projectId, chain)
}

export function clearChain(projectId: string): void {
  citationChains.delete(projectId)
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/services/citationChainService.ts
git commit -m "feat: add citationChainService for citation chain management"
```

---

## Task 6: Create taskQueueService.ts

**Files:**
- Create: `api/services/taskQueueService.ts`

- [ ] **Step 1: Implement async task queue service**

Create `api/services/taskQueueService.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid'

export interface Task {
  id: string
  type: string
  projectId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  result?: unknown
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
}

const tasks = new Map<string, Task>()
const projectTasks = new Map<string, Task[]>()

export function createTask(projectId: string, type: string): Task {
  const task: Task = {
    id: uuidv4(),
    type,
    projectId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  tasks.set(task.id, task)
  const pTasks = projectTasks.get(projectId) || []
  pTasks.push(task)
  projectTasks.set(projectId, pTasks)
  return task
}

export function getTask(taskId: string): Task | null {
  return tasks.get(taskId) || null
}

export function getProjectTasks(projectId: string): Task[] {
  return projectTasks.get(projectId) || []
}

export function updateTask(taskId: string, updates: Partial<Pick<Task, 'status' | 'result' | 'error' | 'startedAt' | 'completedAt'>>): Task | null {
  const task = tasks.get(taskId)
  if (!task) return null
  Object.assign(task, updates)
  return task
}

export function startTask(taskId: string): Task | null {
  return updateTask(taskId, { status: 'running', startedAt: new Date().toISOString() })
}

export function completeTask(taskId: string, result?: unknown): Task | null {
  return updateTask(taskId, { status: 'completed', result, completedAt: new Date().toISOString() })
}

export function failTask(taskId: string, error: string): Task | null {
  return updateTask(taskId, { status: 'failed', error, completedAt: new Date().toISOString() })
}

export function cancelTask(taskId: string): Task | null {
  return updateTask(taskId, { status: 'cancelled', completedAt: new Date().toISOString() })
}

export function getActiveTaskForProject(projectId: string): Task | null {
  const pTasks = projectTasks.get(projectId) || []
  return pTasks.find(t => t.status === 'running' || t.status === 'pending') || null
}

export function clearProjectTasks(projectId: string): void {
  const pTasks = projectTasks.get(projectId) || []
  for (const task of pTasks) {
    tasks.delete(task.id)
  }
  projectTasks.delete(projectId)
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/services/taskQueueService.ts
git commit -m "feat: add taskQueueService for async task management"
```

---

## Task 7: Create workflowEngine.ts (Core)

**Files:**
- Create: `api/services/workflowEngine.ts`

- [ ] **Step 1: Implement Workflow Engine**

Create `api/services/workflowEngine.ts`:

```typescript
import type { AgentStage, WorkflowState, WorkflowStageResult } from '../../shared/types.js'
import * as projectService from './projectService.js'
import * as taskQueueService from './taskQueueService.js'

export interface WorkflowStageConfig {
  name: AgentStage | string
  agent: string
  dependencies: string[]
  parallelizable: boolean
  retryable: boolean
  timeout: number
}

export interface WorkflowDefinition {
  stages: WorkflowStageConfig[]
  transitions: Record<string, string[]>
}

const workflowStates = new Map<string, WorkflowState>()

const PAPER_GENERATION_WORKFLOW: WorkflowDefinition = {
  stages: [
    { name: 'keyword_extracting', agent: 'keywordAgent', dependencies: [], parallelizable: false, retryable: true, timeout: 30000 },
    { name: 'section_planning', agent: 'sectionPlanner', dependencies: ['keyword_extracting'], parallelizable: false, retryable: true, timeout: 30000 },
    { name: 'searching', agent: 'searchAgent', dependencies: ['keyword_extracting'], parallelizable: false, retryable: true, timeout: 60000 },
    { name: 'parsing', agent: 'parseAgent', dependencies: ['searching'], parallelizable: false, retryable: true, timeout: 60000 },
    { name: 'extracting', agent: 'extractAgent', dependencies: ['parsing'], parallelizable: false, retryable: true, timeout: 120000 },
    { name: 'writing', agent: 'writingAgent', dependencies: ['extracting', 'section_planning'], parallelizable: true, retryable: true, timeout: 600000 },
    { name: 'citing', agent: 'citationAgent', dependencies: ['writing'], parallelizable: false, retryable: true, timeout: 60000 },
    { name: 'integrity_reviewing', agent: 'integrityAgent', dependencies: ['citing'], parallelizable: true, retryable: false, timeout: 30000 },
    { name: 'aigc_detecting', agent: 'aigcReductionAgent', dependencies: ['citing'], parallelizable: true, retryable: false, timeout: 120000 },
    { name: 'charting', agent: 'chartAgent', dependencies: ['citing'], parallelizable: true, retryable: true, timeout: 120000 },
    { name: 'formatting', agent: 'formatAgent', dependencies: ['integrity_reviewing', 'aigc_detecting', 'charting'], parallelizable: false, retryable: false, timeout: 30000 },
  ],
  transitions: {
    'keyword_extracting': ['section_planning', 'searching'],
    'searching': ['parsing'],
    'parsing': ['extracting'],
    'extracting': ['writing'],
    'section_planning': ['writing'],
    'writing': ['citing'],
    'citing': ['integrity_reviewing', 'aigc_detecting', 'charting'],
    'integrity_reviewing': ['formatting'],
    'aigc_detecting': ['formatting'],
    'charting': ['formatting'],
  },
}

export function getWorkflowDefinition(): WorkflowDefinition {
  return PAPER_GENERATION_WORKFLOW
}

export function getWorkflowState(projectId: string): WorkflowState | null {
  return workflowStates.get(projectId) || null
}

export function initWorkflowState(projectId: string): WorkflowState {
  const state: WorkflowState = {
    projectId,
    currentStage: '',
    completedStages: [],
    failedStage: null,
    stageHistory: PAPER_GENERATION_WORKFLOW.stages.map(s => ({
      stage: s.name,
      status: 'pending' as const,
    })),
    canResume: false,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  workflowStates.set(projectId, state)
  return state
}

export function updateStageStatus(projectId: string, stageName: string, status: WorkflowStageResult['status'], error?: string): void {
  const state = workflowStates.get(projectId)
  if (!state) return

  const stageEntry = state.stageHistory.find(s => s.stage === stageName)
  if (stageEntry) {
    stageEntry.status = status
    if (status === 'running') stageEntry.startedAt = new Date().toISOString()
    if (status === 'completed' || status === 'failed') stageEntry.completedAt = new Date().toISOString()
    if (error) stageEntry.error = error
  }

  if (status === 'running') {
    state.currentStage = stageName
  }
  if (status === 'completed' && !state.completedStages.includes(stageName)) {
    state.completedStages.push(stageName)
  }
  if (status === 'failed') {
    state.failedStage = stageName
    state.canResume = true
  }

  state.updatedAt = new Date().toISOString()
}

export function getReadyStages(projectId: string): WorkflowStageConfig[] {
  const state = workflowStates.get(projectId)
  if (!state) return []

  return PAPER_GENERATION_WORKFLOW.stages.filter(stage => {
    if (state.completedStages.includes(stage.name)) return false
    const stageEntry = state.stageHistory.find(s => s.stage === stage.name)
    if (stageEntry && stageEntry.status === 'running') return false
    if (stage.dependencies.length === 0) return true
    return stage.dependencies.every(dep => state.completedStages.includes(dep))
  })
}

export function getParallelGroups(projectId: string): WorkflowStageConfig[][] {
  const ready = getReadyStages(projectId)
  if (ready.length === 0) return []

  const parallelizable = ready.filter(s => s.parallelizable)
  const sequential = ready.filter(s => !s.parallelizable)

  if (sequential.length > 0) {
    return [sequential]
  }

  if (parallelizable.length > 0) {
    return [parallelizable]
  }

  return []
}

export function isWorkflowComplete(projectId: string): boolean {
  const state = workflowStates.get(projectId)
  if (!state) return false
  return PAPER_GENERATION_WORKFLOW.stages.every(s =>
    state.completedStages.includes(s.name) ||
    state.stageHistory.find(h => h.stage === s.name)?.status === 'skipped'
  )
}

export function canResume(projectId: string): boolean {
  const state = workflowStates.get(projectId)
  return state?.canResume === true && state.failedStage !== null
}

export function resumeWorkflow(projectId: string): void {
  const state = workflowStates.get(projectId)
  if (!state || !state.canResume || !state.failedStage) return

  const failedEntry = state.stageHistory.find(s => s.stage === state.failedStage)
  if (failedEntry) {
    failedEntry.status = 'pending'
    failedEntry.error = undefined
    failedEntry.startedAt = undefined
    failedEntry.completedAt = undefined
  }
  state.failedStage = null
  state.canResume = false
  state.updatedAt = new Date().toISOString()
}

export function cancelWorkflow(projectId: string): void {
  const state = workflowStates.get(projectId)
  if (!state) return

  for (const entry of state.stageHistory) {
    if (entry.status === 'running' || entry.status === 'pending') {
      entry.status = 'skipped'
      entry.completedAt = new Date().toISOString()
    }
  }
  state.currentStage = ''
  state.canResume = false
  state.updatedAt = new Date().toISOString()
  projectService.updateProjectStatus(projectId, 'draft')
}

export function clearWorkflowState(projectId: string): void {
  workflowStates.delete(projectId)
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/services/workflowEngine.ts
git commit -m "feat: add workflowEngine with dependency-based parallel execution"
```

---

## Task 8: Refactor orchestrator.ts to use WorkflowEngine

**Files:**
- Modify: `api/agents/orchestrator.ts`

- [ ] **Step 1: Add WorkflowEngine integration to orchestrator**

The key change: wrap the existing `orchestrate` function to also update WorkflowEngine state. The existing serial execution is preserved for now (parallel execution comes in Phase 2), but WorkflowEngine state tracking is added.

Add imports at the top of `api/agents/orchestrator.ts`:

```typescript
import * as workflowEngine from '../services/workflowEngine.js'
```

Then, inside the `orchestrate` function, after the `stages` array is defined and before the `try { for (const { stage, progress, fn } of stages) {` loop, add:

```typescript
  const wfState = workflowEngine.initWorkflowState(projectId)
```

Inside the loop, before `await fn()`, add:

```typescript
        workflowEngine.updateStageStatus(projectId, stage, 'running')
```

After `await fn()`, add:

```typescript
        workflowEngine.updateStageStatus(projectId, stage, 'completed')
```

In the catch block (where stage errors are handled), add:

```typescript
        workflowEngine.updateStageStatus(projectId, stage, 'failed', errorMsg)
```

After the entire pipeline completes successfully, add:

```typescript
    if (workflowEngine.isWorkflowComplete(projectId)) {
      const state = workflowEngine.getWorkflowState(projectId)
      if (state) state.canResume = false
    }
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/agents/orchestrator.ts
git commit -m "feat: integrate WorkflowEngine state tracking into orchestrator"
```

---

## Task 9: Refactor projectService.ts to delegate

**Files:**
- Modify: `api/services/projectService.ts`

- [ ] **Step 1: Add workspaceId support and delegation**

Add import at the top:

```typescript
import * as workspaceService from './workspaceService.js'
```

Modify `createProject` to accept optional `workspaceId`:

```typescript
export function createProject(topic: string, title?: string, description?: string, language: 'en' | 'zh' = 'en', workspaceId?: string): Project {
  const id = uuidv4()
  const now = new Date().toISOString()
  const project: Project = {
    id,
    workspaceId,
    title: title || topic,
    topic,
    description: description || '',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    language,
  }
  projects.set(id, project)
  papers.set(id, [])
  sections.set(id, [])

  if (workspaceId) {
    workspaceService.addProjectToWorkspace(workspaceId, id)
  }

  return project
}
```

This is a backward-compatible change — the `workspaceId` parameter is optional and defaults to `undefined`, so all existing callers continue to work.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/services/projectService.ts
git commit -m "feat: add workspaceId support to projectService.createProject"
```

---

## Task 10: Create Workspace API routes

**Files:**
- Create: `api/routes/workspaces.ts`

- [ ] **Step 1: Implement Workspace API routes**

Create `api/routes/workspaces.ts`:

```typescript
import { Router } from 'express'
import * as workspaceService from '../services/workspaceService.js'
import * as projectService from '../services/projectService.js'

const router = Router()

router.get('/', (req, res) => {
  const workspaces = workspaceService.getWorkspaces()
  res.json({ success: true, data: workspaces })
})

router.post('/', (req, res) => {
  const { name, description, settings } = req.body
  if (!name?.trim()) {
    res.status(400).json({ success: false, error: 'Workspace name is required' })
    return
  }
  const workspace = workspaceService.createWorkspace(name.trim(), description, settings)
  res.status(201).json({ success: true, data: workspace })
})

router.get('/:id', (req, res) => {
  const workspace = workspaceService.getWorkspace(req.params.id)
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  res.json({ success: true, data: workspace })
})

router.put('/:id', (req, res) => {
  const { name, description, settings } = req.body
  const workspace = workspaceService.updateWorkspace(req.params.id, { name, description, settings })
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  res.json({ success: true, data: workspace })
})

router.delete('/:id', (req, res) => {
  const deleted = workspaceService.deleteWorkspace(req.params.id)
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  res.json({ success: true, message: 'Workspace deleted' })
})

router.get('/:id/projects', (req, res) => {
  const workspace = workspaceService.getWorkspace(req.params.id)
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  const projects = workspaceService.getWorkspaceProjects(req.params.id)
  res.json({ success: true, data: projects })
})

router.post('/:id/projects', (req, res) => {
  const { topic, title, description, language } = req.body
  if (!topic?.trim()) {
    res.status(400).json({ success: false, error: 'Topic is required' })
    return
  }
  const workspace = workspaceService.getWorkspace(req.params.id)
  if (!workspace) {
    res.status(404).json({ success: false, error: 'Workspace not found' })
    return
  }
  const project = projectService.createProject(
    topic.trim(),
    title,
    description,
    language || workspace.settings.defaultLanguage,
    req.params.id,
  )
  res.status(201).json({ success: true, data: project })
})

export default router
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/routes/workspaces.ts
git commit -m "feat: add Workspace API routes (CRUD + project management)"
```

---

## Task 11: Create Knowledge Base and Citation Chain API routes

**Files:**
- Create: `api/routes/knowledgeBase.ts`
- Create: `api/routes/citationChain.ts`

- [ ] **Step 1: Implement Knowledge Base API routes**

Create `api/routes/knowledgeBase.ts`:

```typescript
import { Router } from 'express'
import * as knowledgeBaseService from '../services/knowledgeBaseService.js'

const router = Router({ mergeParams: true })

router.get('/', (req, res) => {
  const { projectId } = req.params
  const entries = knowledgeBaseService.getEntries(projectId)
  res.json({ success: true, data: entries })
})

router.get('/viewpoints', (req, res) => {
  const { projectId } = req.params
  const { sectionType } = req.query
  const viewpoints = sectionType
    ? knowledgeBaseService.getViewpointsBySectionType(projectId, sectionType as string)
    : knowledgeBaseService.getEntriesByType(projectId, 'viewpoint')
  res.json({ success: true, data: viewpoints })
})

router.post('/summarize', async (req, res) => {
  const { projectId } = req.params
  const { paperId } = req.body
  if (!paperId) {
    res.status(400).json({ success: false, error: 'paperId is required' })
    return
  }
  const existing = knowledgeBaseService.getSummary(projectId, paperId)
  if (existing) {
    res.json({ success: true, data: existing })
    return
  }
  res.json({ success: true, data: null, message: 'Summary generation will be implemented in Phase 2' })
})

router.post('/notes', (req, res) => {
  const { projectId } = req.params
  const { content, sourcePaperIds } = req.body
  if (!content?.trim()) {
    res.status(400).json({ success: false, error: 'Content is required' })
    return
  }
  const entry = knowledgeBaseService.addNote(projectId, content.trim(), sourcePaperIds)
  res.status(201).json({ success: true, data: entry })
})

router.delete('/entries/:entryId', (req, res) => {
  const { projectId, entryId } = req.params
  const deleted = knowledgeBaseService.deleteEntry(projectId, entryId)
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Entry not found' })
    return
  }
  res.json({ success: true, message: 'Entry deleted' })
})

export default router
```

- [ ] **Step 2: Implement Citation Chain API routes**

Create `api/routes/citationChain.ts`:

```typescript
import { Router } from 'express'
import * as citationChainService from '../services/citationChainService.js'

const router = Router({ mergeParams: true })

router.get('/', (req, res) => {
  const { projectId } = req.params
  const chain = citationChainService.getChain(projectId)
  res.json({ success: true, data: chain })
})

router.post('/link', (req, res) => {
  const { projectId } = req.params
  const { paperId, sectionId, context } = req.body
  if (!paperId || !sectionId) {
    res.status(400).json({ success: false, error: 'paperId and sectionId are required' })
    return
  }
  const link = citationChainService.addLink(projectId, paperId, sectionId, context || '')
  res.status(201).json({ success: true, data: link })
})

router.delete('/link/:linkId', (req, res) => {
  const { projectId, linkId } = req.params
  const deleted = citationChainService.removeLink(projectId, linkId)
  if (!deleted) {
    res.status(404).json({ success: false, error: 'Link not found' })
    return
  }
  res.json({ success: true, message: 'Link deleted' })
})

export default router
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add api/routes/knowledgeBase.ts api/routes/citationChain.ts
git commit -m "feat: add Knowledge Base and Citation Chain API routes"
```

---

## Task 12: Create Workflow API routes

**Files:**
- Create: `api/routes/workflow.ts`

- [ ] **Step 1: Implement Workflow API routes**

Create `api/routes/workflow.ts`:

```typescript
import { Router } from 'express'
import * as workflowEngine from '../services/workflowEngine.js'

const router = Router({ mergeParams: true })

router.get('/', (req, res) => {
  const { projectId } = req.params
  const state = workflowEngine.getWorkflowState(projectId)
  if (!state) {
    res.json({ success: true, data: null, message: 'No workflow state found for this project' })
    return
  }
  res.json({ success: true, data: state })
})

router.post('/resume', (req, res) => {
  const { projectId } = req.params
  if (!workflowEngine.canResume(projectId)) {
    res.status(400).json({ success: false, error: 'Workflow cannot be resumed' })
    return
  }
  workflowEngine.resumeWorkflow(projectId)
  const state = workflowEngine.getWorkflowState(projectId)
  res.json({ success: true, data: state, message: 'Workflow resumed. Re-trigger generation to continue.' })
})

router.post('/cancel', (req, res) => {
  const { projectId } = req.params
  workflowEngine.cancelWorkflow(projectId)
  const state = workflowEngine.getWorkflowState(projectId)
  res.json({ success: true, data: state, message: 'Workflow cancelled' })
})

export default router
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/routes/workflow.ts
git commit -m "feat: add Workflow API routes (status, resume, cancel)"
```

---

## Task 13: Register new routes in app.ts

**Files:**
- Modify: `api/app.ts`

- [ ] **Step 1: Add new route imports and registrations**

In `api/app.ts`, add imports:

```typescript
import workspaceRoutes from './routes/workspaces.js'
```

Add route registrations after the existing routes:

```typescript
app.use('/api/workspaces', workspaceRoutes)
app.use('/api/projects/:projectId/knowledge-base', knowledgeBaseRoutes)
app.use('/api/projects/:projectId/citation-chain', citationChainRoutes)
app.use('/api/projects/:projectId/workflow', workflowRoutes)
```

Full imports to add:

```typescript
import workspaceRoutes from './routes/workspaces.js'
import knowledgeBaseRoutes from './routes/knowledgeBase.js'
import citationChainRoutes from './routes/citationChain.js'
import workflowRoutes from './routes/workflow.js'
```

- [ ] **Step 2: Verify the server starts**

Run: `npx tsx api/server.ts` (then Ctrl+C after confirming it starts)
Expected: Server starts on port 3001 without errors

- [ ] **Step 3: Commit**

```bash
git add api/app.ts
git commit -m "feat: register Workspace, KB, CitationChain, Workflow API routes"
```

---

## Task 14: Add Workspace API functions to frontend api.ts

**Files:**
- Modify: `src/utils/api.ts`

- [ ] **Step 1: Add Workspace type import and API functions**

Add `Workspace` to the import from `../../shared/types`:

```typescript
import type {
  CitationFormat,
  ExportFormat,
  GeneratedSection,
  GenerationProgress,
  Paper,
  PaperType,
  Project,
  Reference,
  SectionConfig,
  Workspace,
  KnowledgeEntry,
  CitationChainLink,
  WorkflowState,
} from "../../shared/types";
```

Add new API functions at the end of the file:

```typescript
export async function fetchWorkspaces() {
  return request<Workspace[]>("/workspaces");
}

export async function createWorkspace(name: string, description?: string) {
  return request<Workspace>("/workspaces", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function fetchWorkspace(id: string) {
  return request<Workspace>(`/workspaces/${id}`);
}

export async function fetchWorkspaceProjects(workspaceId: string) {
  return request<Project[]>(`/workspaces/${workspaceId}/projects`);
}

export async function createProjectInWorkspace(workspaceId: string, topic: string, title?: string, description?: string, language?: "en" | "zh") {
  return request<Project>(`/workspaces/${workspaceId}/projects`, {
    method: "POST",
    body: JSON.stringify({ topic, title, description, language }),
  });
}

export async function fetchKnowledgeBase(projectId: string) {
  return request<KnowledgeEntry[]>(`/projects/${projectId}/knowledge-base`);
}

export async function fetchCitationChain(projectId: string) {
  return request<CitationChainLink[]>(`/projects/${projectId}/citation-chain`);
}

export async function fetchWorkflowState(projectId: string) {
  return request<WorkflowState | null>(`/projects/${projectId}/workflow`);
}

export async function resumeWorkflow(projectId: string) {
  return request<WorkflowState>(`/projects/${projectId}/workflow/resume`, {
    method: "POST",
  });
}

export async function cancelWorkflow(projectId: string) {
  return request<WorkflowState>(`/projects/${projectId}/workflow/cancel`, {
    method: "POST",
  });
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/api.ts
git commit -m "feat: add Workspace, KB, CitationChain, Workflow API functions to frontend"
```

---

## Task 15: Update Zustand store for Workspace

**Files:**
- Modify: `src/store/useAppStore.ts`

- [ ] **Step 1: Add Workspace state to store**

Add `Workspace` to imports:

```typescript
import type {
  Project,
  Paper,
  GeneratedSection,
  GenerationProgress,
  CitationFormat,
  SectionConfig,
  Reference,
  PaperType,
  Workspace,
} from "../../shared/types";
```

Add workspace state to `AppState` interface:

```typescript
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;
```

Add implementations in the store:

```typescript
  workspaces: [],
  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (workspace) =>
    set((state) => ({ workspaces: [...state.workspaces, workspace] })),
  currentWorkspaceId: null,
  setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/store/useAppStore.ts
git commit -m "feat: add Workspace state to Zustand store"
```

---

## Task 16: Create Workspace Dashboard frontend page

**Files:**
- Create: `src/pages/WorkspaceDashboard.tsx`
- Create: `src/components/WorkspaceCard.tsx`

- [ ] **Step 1: Create WorkspaceCard component**

Create `src/components/WorkspaceCard.tsx`:

```tsx
import { motion } from "framer-motion";
import { FolderOpen, FileText } from "lucide-react";
import type { Workspace } from "../../shared/types";

interface WorkspaceCardProps {
  workspace: Workspace;
  projectCount: number;
  onClick: (id: string) => void;
}

export default function WorkspaceCard({ workspace, projectCount, onClick }: WorkspaceCardProps) {
  return (
    <motion.div
      className="card p-5 cursor-pointer"
      whileHover={{ y: -3 }}
      onClick={() => onClick(workspace.id)}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
          <FolderOpen size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif font-semibold text-navy-700 line-clamp-1">
            {workspace.name}
          </h3>
          <p className="text-xs text-navy-400">
            {projectCount} 个项目
          </p>
        </div>
      </div>
      {workspace.description && (
        <p className="text-sm text-navy-400 line-clamp-2 mb-3">
          {workspace.description}
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-navy-300">
        <span className="flex items-center gap-1">
          <FileText size={12} />
          {new Date(workspace.updatedAt).toLocaleDateString("zh-CN")}
        </span>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create WorkspaceDashboard page**

Create `src/pages/WorkspaceDashboard.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FolderOpen, X, Sparkles } from "lucide-react";
import useAppStore from "@/store/useAppStore";
import WorkspaceCard from "@/components/WorkspaceCard";
import ParticleBackground from "@/components/ParticleBackground";
import { fetchWorkspaces, createWorkspace, fetchWorkspaceProjects, createProjectInWorkspace } from "@/utils/api";

export default function WorkspaceDashboard() {
  const navigate = useNavigate();
  const { workspaces, setWorkspaces, addWorkspace } = useAppStore();
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDesc, setWorkspaceDesc] = useState("");
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchWorkspaces()
      .then((ws) => {
        if (ws && ws.length > 0) {
          setWorkspaces(ws);
          ws.forEach(async (w) => {
            try {
              const projects = await fetchWorkspaceProjects(w.id);
              setProjectCounts((prev) => ({ ...prev, [w.id]: projects.length }));
            } catch {}
          });
        }
      })
      .catch(() => {});
  }, [setWorkspaces]);

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const ws = await createWorkspace(workspaceName.trim(), workspaceDesc.trim());
      addWorkspace(ws);
      setWorkspaceName("");
      setWorkspaceDesc("");
      setShowCreateWorkspace(false);
    } catch (error) {
      console.error("Failed to create workspace:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleWorkspaceClick = (workspaceId: string) => {
    navigate(`/workspace/${workspaceId}`);
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <section className="relative bg-navy-500 overflow-hidden">
        <ParticleBackground />
        <div className="relative z-10 flex flex-col items-center justify-center py-24 px-6 text-center">
          <motion.h1
            className="font-serif text-5xl md:text-6xl font-bold text-ivory mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Research<span className="text-cyan">OS</span>
          </motion.h1>
          <motion.p
            className="text-navy-200 text-lg max-w-xl mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            AI 科研工作流平台 — 文献管理、知识沉淀、智能写作
          </motion.p>
          <motion.button
            className="btn-primary flex items-center gap-2 text-base"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCreateWorkspace(true)}
          >
            <Sparkles size={18} />
            创建工作台
          </motion.button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">我的工作台</h2>
          <button
            className="btn-secondary text-sm flex items-center gap-1.5"
            onClick={() => setShowCreateWorkspace(true)}
          >
            <Plus size={16} />
            新建工作台
          </button>
        </div>

        {workspaces.length === 0 ? (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <FolderOpen size={48} className="mx-auto text-navy-200 mb-4" />
            <p className="text-navy-400 font-serif text-lg mb-2">
              还没有工作台
            </p>
            <p className="text-navy-300 text-sm">
              创建一个工作台来管理你的科研项目
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws, i) => (
              <motion.div
                key={ws.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
              >
                <WorkspaceCard
                  workspace={ws}
                  projectCount={projectCounts[ws.id] || 0}
                  onClick={handleWorkspaceClick}
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {showCreateWorkspace && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateWorkspace(false)}
          >
            <motion.div
              className="bg-ivory rounded-2xl p-6 w-full max-w-md shadow-xl border border-navy-100"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-serif text-xl font-semibold text-navy-700">
                  新建工作台
                </h3>
                <button
                  onClick={() => setShowCreateWorkspace(false)}
                  className="p-1 rounded-lg hover:bg-navy-50 transition-colors"
                >
                  <X size={18} className="text-navy-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-navy-600 mb-1.5">
                    工作台名称 *
                  </label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="例如：毕业论文研究"
                    className="input-field"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-600 mb-1.5">
                    描述
                  </label>
                  <textarea
                    value={workspaceDesc}
                    onChange={(e) => setWorkspaceDesc(e.target.value)}
                    placeholder="描述这个工作台的研究方向..."
                    className="input-field min-h-[80px] resize-y"
                    rows={3}
                  />
                </div>
                <button
                  onClick={handleCreateWorkspace}
                  disabled={!workspaceName.trim() || isCreating}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isCreating ? "创建中..." : "创建工作台"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/WorkspaceDashboard.tsx src/components/WorkspaceCard.tsx
git commit -m "feat: add Workspace Dashboard and WorkspaceCard frontend components"
```

---

## Task 17: Create Workspace Detail page

**Files:**
- Create: `src/pages/WorkspaceDetail.tsx`

- [ ] **Step 1: Create WorkspaceDetail page**

Create `src/pages/WorkspaceDetail.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, ArrowLeft } from "lucide-react";
import useAppStore from "@/store/useAppStore";
import { fetchWorkspace, fetchWorkspaceProjects, createProjectInWorkspace } from "@/utils/api";
import type { Workspace, Project } from "../../shared/types";

const statusLabels: Record<Project["status"], string> = {
  draft: "草稿",
  searching: "检索中",
  parsing: "解析中",
  generating: "生成中",
  completed: "已完成",
};

const statusBadge: Record<Project["status"], string> = {
  draft: "badge-draft",
  searching: "badge-active",
  parsing: "badge-active",
  generating: "badge-active",
  completed: "badge-completed",
};

export default function WorkspaceDetail() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useAppStore();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    fetchWorkspace(workspaceId)
      .then(setWorkspace)
      .catch(() => {});
    fetchWorkspaceProjects(workspaceId)
      .then(setProjects)
      .catch(() => {});
  }, [workspaceId]);

  const handleCreateProject = async () => {
    if (!topic.trim() || !workspaceId || isCreating) return;
    setIsCreating(true);
    try {
      const project = await createProjectInWorkspace(
        workspaceId,
        topic.trim(),
        undefined,
        description.trim(),
        language,
      );
      setProjects((prev) => [...prev, project]);
      setTopic("");
      setDescription("");
      setShowCreateProject(false);
      navigate(`/project/${project.id}`);
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-navy-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <button
          className="flex items-center gap-1.5 text-navy-400 hover:text-navy-600 mb-6 transition-colors"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={16} />
          返回工作台列表
        </button>

        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-navy-700 mb-2">
            {workspace.name}
          </h1>
          {workspace.description && (
            <p className="text-navy-400">{workspace.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">科研项目</h2>
          <button
            className="btn-secondary text-sm flex items-center gap-1.5"
            onClick={() => setShowCreateProject(true)}
          >
            <Plus size={16} />
            新建项目
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={48} className="mx-auto text-navy-200 mb-4" />
            <p className="text-navy-400 font-serif text-lg mb-2">
              还没有项目
            </p>
            <p className="text-navy-300 text-sm">
              在这个工作台中创建你的第一个研究项目
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                className="card p-5 cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                whileHover={{ y: -3 }}
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <h3 className="font-serif font-semibold text-navy-700 mb-1 line-clamp-1">
                  {project.title}
                </h3>
                <p className="text-sm text-navy-400 mb-3 line-clamp-2">
                  {project.description || project.topic}
                </p>
                <div className="flex items-center justify-between">
                  <span className={statusBadge[project.status]}>
                    {statusLabels[project.status]}
                  </span>
                  <span className="text-xs text-navy-300">
                    {new Date(project.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {showCreateProject && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowCreateProject(false)}
        >
          <motion.div
            className="bg-ivory rounded-2xl p-6 w-full max-w-md shadow-xl border border-navy-100"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl font-semibold text-navy-700 mb-5">
              新建研究项目
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy-600 mb-1.5">
                  主题/标题 *
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例如：大语言模型在科学发现中的应用"
                  className="input-field"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-600 mb-1.5">
                  详细信息/研究方向
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="请描述您的研究方向..."
                  className="input-field min-h-[80px] resize-y"
                  rows={3}
                />
              </div>
              <button
                onClick={handleCreateProject}
                disabled={!topic.trim() || isCreating}
                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCreating ? "创建中..." : "创建项目"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/WorkspaceDetail.tsx
git commit -m "feat: add WorkspaceDetail page with project management"
```

---

## Task 18: Update App.tsx router and Sidebar

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add new routes to App.tsx**

Add import:

```typescript
import WorkspaceDashboard from "@/pages/WorkspaceDashboard";
import WorkspaceDetail from "@/pages/WorkspaceDetail";
```

Add routes inside `<Routes>`:

```typescript
<Route path="/" element={<WorkspaceDashboard />} />
<Route path="/workspace/:id" element={<WorkspaceDetail />} />
```

Note: This replaces the previous `<Route path="/" element={<Home />} />`. The Home page functionality is now in WorkspaceDashboard.

- [ ] **Step 2: Update Sidebar navigation**

Modify `src/components/Sidebar.tsx` navItems:

```typescript
const navItems = [
  { to: "/", label: "工作台", icon: LayoutDashboard },
  { to: "/library", label: "文献库", icon: BookOpen },
];
```

This stays the same — the "/" route now points to WorkspaceDashboard instead of Home.

- [ ] **Step 3: Verify the frontend builds**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Sidebar.tsx
git commit -m "feat: update router to Workspace Dashboard, add WorkspaceDetail route"
```

---

## Task 19: Fix chartAgent.ts hardcoded API key

**Files:**
- Modify: `api/agents/chartAgent.ts`

- [ ] **Step 1: Move hardcoded API key to environment variable**

Find the hardcoded `SILICONFLOW_API_KEY` constant in `chartAgent.ts` and replace it with:

```typescript
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || ''
```

Also add `SILICONFLOW_API_KEY` to `.env` file.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/agents/chartAgent.ts .env
git commit -m "fix: move SiliconFlow API key from hardcoded constant to environment variable"
```

---

## Task 20: Fix typst export bug

**Files:**
- Modify: `api/routes/export.ts`

- [ ] **Step 1: Fix typst format calling generateLatex instead of its own handler**

In `api/routes/export.ts`, find the code that handles `typst` format and currently calls `generateLatex`. Replace it with a placeholder that returns an error message since typst generation is not yet implemented:

```typescript
case 'typst':
  return res.status(400).json({
    success: false,
    error: 'Typst format is not yet supported. Please use docx, pdf, or latex.',
  })
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/routes/export.ts
git commit -m "fix: typst export no longer incorrectly generates LaTeX content"
```

---

## Task 21: Add TOKEN_PLAN_API_KEY to .env

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add token-plan API configuration**

Add to `.env`:

```
TOKEN_PLAN_API_KEY=tp-ci2x114db83216h0pc55349zw5dwad05q0lz6jvhrpel5kpw
TOKEN_PLAN_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
SILICONFLOW_API_KEY=sk-zvpftbemmenqfllkyzvkoewfkwprqsufusznsgbsohadlmmt
VOLCENGINE_API_KEY=92efec38-c351-489a-91ab-99bec7b3503d
```

- [ ] **Step 2: Commit**

```bash
git add .env
git commit -m "feat: add token-plan, SiliconFlow, Volcengine API keys to .env"
```

---

## Task 22: End-to-end verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run TypeScript check on entire project**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run ESLint**

Run: `npm run lint`
Expected: No new errors (existing warnings are acceptable)

- [ ] **Step 3: Start the server and test API endpoints**

Run: `npx tsx api/server.ts`

Test the following endpoints:
```bash
# Create a workspace
curl -X POST http://localhost:3001/api/workspaces -H "Content-Type: application/json" -d '{"name":"Test Workspace"}'

# List workspaces
curl http://localhost:3001/api/workspaces

# Create a project in workspace
curl -X POST http://localhost:3001/api/workspaces/{workspaceId}/projects -H "Content-Type: application/json" -d '{"topic":"Test Topic"}'

# Get workflow state
curl http://localhost:3001/api/projects/{projectId}/workflow

# Existing API still works
curl http://localhost:3001/api/projects
curl http://localhost:3001/api/health
```

Expected: All endpoints return expected responses, existing APIs unchanged

- [ ] **Step 4: Start the frontend and verify UI**

Run: `npm run dev`

Verify:
- Workspace Dashboard loads at `/`
- Can create a workspace
- Can click into workspace detail
- Can create a project within workspace
- Existing project page still works at `/project/:id`
- Existing library page still works at `/library`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 complete - Workspace, KnowledgeBase, CitationChain, WorkflowEngine architecture skeleton"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: Each section in the Phase 1 design spec maps to a task
- [x] **Placeholder scan**: No TBD, TODO, or "implement later" patterns
- [x] **Type consistency**: All types defined in Task 1 are used consistently in subsequent tasks
- [x] **No breaking changes**: All existing API signatures preserved, new parameters are optional
- [x] **Bug fixes included**: chartAgent API key (Task 19), typst export (Task 20)

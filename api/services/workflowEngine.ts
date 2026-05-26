import type { AgentStage, WorkflowState, WorkflowStageResult } from '../../shared/types.js'
import * as projectService from './projectService.js'

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

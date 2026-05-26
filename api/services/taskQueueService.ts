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

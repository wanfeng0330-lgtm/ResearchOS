import { Router, type Request, type Response } from 'express'
import * as projectService from '../services/projectService.js'

const router = Router()

const clients = new Map<string, Set<Response>>()

function sendSSE(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function broadcastToProject(projectId: string, event: string, data: unknown): void {
  const projectClients = clients.get(projectId)
  if (!projectClients) return
  for (const client of projectClients) {
    try {
      sendSSE(client, event, data)
    } catch {
      projectClients.delete(client)
    }
  }
}

router.get('/generate/:projectId', (req: Request, res: Response) => {
  const { projectId } = req.params

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })

  res.write(`event: connected\ndata: ${JSON.stringify({ projectId })}\n\n`)

  if (!clients.has(projectId)) {
    clients.set(projectId, new Set())
  }
  clients.get(projectId)!.add(res)

  const currentProgress = projectService.getProgress(projectId)
  if (currentProgress) {
    sendSSE(res, 'progress', currentProgress)
  }

  req.on('close', () => {
    const projectClients = clients.get(projectId)
    if (projectClients) {
      projectClients.delete(res)
      if (projectClients.size === 0) {
        clients.delete(projectId)
      }
    }
  })
})

export function getConnectedClients(projectId: string): number {
  return clients.get(projectId)?.size || 0
}

export default router

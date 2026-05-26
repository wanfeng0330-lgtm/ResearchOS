import 'dotenv/config'
import app from './app.js'
import * as projectService from './services/projectService.js'
import * as workspaceService from './services/workspaceService.js'
import { initializeDatabase, closeDatabase } from './db/init.js'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

projectService.setWorkspaceLinker(workspaceService.addProjectToWorkspace)

const uploadsDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true })
}

await initializeDatabase()

const PORT = process.env.PORT || 3001

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received')
  server.close(async () => {
    await closeDatabase()
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT signal received')
  server.close(async () => {
    await closeDatabase()
    console.log('Server closed')
    process.exit(0)
  })
})

export default app

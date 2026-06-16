import { pgTable, uuid, text, integer, timestamp, jsonb, boolean, real, varchar, index, unique } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).default(''),
  role: varchar('role', { length: 20 }).default('user').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('users_email_unique').on(table.email),
  index('idx_users_email').on(table.email),
])

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').default(''),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id'),
  title: text('title').notNull(),
  topic: text('topic').notNull(),
  description: text('description').default(''),
  status: varchar('status', { length: 50 }).default('draft').notNull(),
  language: varchar('language', { length: 10 }).default('en').notNull(),
  totalWordCount: integer('total_word_count').default(5000),
  paperType: varchar('paper_type', { length: 50 }).default('graduation'),
  citationFormat: varchar('citation_format', { length: 50 }).default('apa'),
  keywords: jsonb('keywords').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_projects_workspace').on(table.workspaceId),
])

export const papers = pgTable('papers', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  authors: jsonb('authors').default([]),
  year: integer('year'),
  abstract: text('abstract'),
  source: text('source').notNull(),
  sourceId: text('source_id'),
  pdfUrl: text('pdf_url'),
  citationCount: integer('citation_count').default(0),
  keywords: jsonb('keywords').default([]),
  bibtex: text('bibtex'),
  doi: text('doi'),
  journal: text('journal'),
  selected: boolean('selected').default(false),
  relevanceScore: real('relevance_score').default(0),
  tags: jsonb('tags').default([]),
  notes: text('notes').default(''),
  summary: text('summary'),
  citationNumber: integer('citation_number'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_papers_project').on(table.projectId),
])

export const knowledgeEntries = pgTable('knowledge_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  content: text('content').notNull(),
  sourcePaperIds: jsonb('source_paper_ids').default([]),
  sectionType: varchar('section_type', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_knowledge_project').on(table.projectId),
])

export const generatedSections = pgTable('generated_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  citations: jsonb('citations').default([]),
  sectionOrder: integer('section_order').notNull(),
  wordCount: integer('word_count').default(0),
  charts: jsonb('charts').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_sections_project').on(table.projectId),
])

export const references = pgTable('references', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  paperId: uuid('paper_id').references(() => papers.id),
  bibtex: text('bibtex'),
  apa: text('apa'),
  ieee: text('ieee'),
  gbt: text('gbt'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_references_project').on(table.projectId),
])

export const workflowStates = pgTable('workflow_states', {
  projectId: uuid('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  currentStage: varchar('current_stage', { length: 100 }),
  completedStages: jsonb('completed_stages').default([]),
  failedStage: varchar('failed_stage', { length: 100 }),
  stageHistory: jsonb('stage_history').default([]),
  canResume: boolean('can_resume').default(false),
  progress: jsonb('progress').default({}),
  startedAt: timestamp('started_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const exportJobs = pgTable('export_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  format: varchar('format', { length: 50 }).notNull(),
  citationFormat: varchar('citation_format', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  filePath: text('file_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const paperEmbeddings = pgTable('paper_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  paperId: uuid('paper_id').notNull().references(() => papers.id, { onDelete: 'cascade' }),
  chunkText: text('chunk_text').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_embeddings_paper').on(table.paperId),
])

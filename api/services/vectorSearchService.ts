import db from '../db/index.js'
import { eq, and, inArray, sql } from 'drizzle-orm'
import * as schema from '../db/schema.js'
import * as paperLibraryService from './paperLibraryService.js'

interface EmbeddingResult {
  paperId: string
  chunkText: string
  similarity: number
}

async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.DEEPSEEK_API_KEY || ''
  const baseUrl = process.env.EMBEDDING_BASE_URL || 'https://api.deepseek.com'
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-v3'

  if (!apiKey) {
    console.warn('[VectorSearch] No embedding API key configured, using fallback')
    return []
  }

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text.slice(0, 8000),
      }),
    })

    if (!response.ok) {
      console.error('[VectorSearch] Embedding API error:', response.status)
      return []
    }

    const data = await response.json()
    return data.data?.[0]?.embedding || []
  } catch (error) {
    console.error('[VectorSearch] Embedding generation failed:', (error as Error).message)
    return []
  }
}

export async function indexPaperChunks(projectId: string, paperId: string, abstract: string): Promise<void> {
  if (!abstract || abstract.length < 50) return

  await db.delete(schema.paperEmbeddings).where(eq(schema.paperEmbeddings.paperId, paperId))

  const chunkSize = 500
  const chunks: string[] = []
  for (let i = 0; i < abstract.length; i += chunkSize) {
    chunks.push(abstract.slice(i, i + chunkSize))
  }

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i])
    if (embedding.length > 0) {
      const embeddingStr = `[${embedding.join(',')}]`
      await db.insert(schema.paperEmbeddings).values({
        paperId,
        chunkText: chunks[i],
        chunkIndex: i,
      })

      await db.execute(sql`
        UPDATE paper_embeddings
        SET embedding = ${embeddingStr}::vector
        WHERE paper_id = ${paperId} AND chunk_index = ${i}
      `)
    }
  }

  console.log(`[VectorSearch] Indexed ${chunks.length} chunks for paper ${paperId}`)
}

export async function vectorSearch(
  query: string,
  projectId: string,
  maxPapers: number = 15
): Promise<EmbeddingResult[]> {
  const queryEmbedding = await generateEmbedding(query)
  if (queryEmbedding.length === 0) {
    console.warn('[VectorSearch] No query embedding generated, falling back to keyword search')
    return []
  }

  const embeddingStr = `[${queryEmbedding.join(',')}]`

  try {
    const results = await db.execute(sql`
      SELECT
        pe.paper_id,
        pe.chunk_text,
        pe.embedding <=> ${embeddingStr}::vector as distance
      FROM paper_embeddings pe
      JOIN papers p ON pe.paper_id = p.id
      WHERE p.project_id = ${projectId}
      ORDER BY pe.embedding <=> ${embeddingStr}::vector
      LIMIT ${maxPapers * 3}
    `)

    const seen = new Set<string>()
    const uniqueResults: EmbeddingResult[] = []
    for (const row of results as unknown as Array<{ paper_id: string; chunk_text: string; distance: number }>) {
      if (!seen.has(row.paper_id)) {
        seen.add(row.paper_id)
        uniqueResults.push({
          paperId: row.paper_id,
          chunkText: row.chunk_text,
          similarity: 1 - row.distance,
        })
      }
      if (uniqueResults.length >= maxPapers) break
    }

    return uniqueResults
  } catch (error) {
    console.error('[VectorSearch] Vector search failed:', (error as Error).message)
    return []
  }
}

export async function indexProjectPapers(projectId: string): Promise<void> {
  const papers = await db.select().from(schema.papers)
    .where(eq(schema.papers.projectId, projectId))

  for (const paper of papers) {
    if (paper.abstract) {
      await indexPaperChunks(projectId, paper.id, paper.abstract)
    }
  }

  console.log(`[VectorSearch] Indexed ${papers.length} papers for project ${projectId}`)
}

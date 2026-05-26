# 分步交互式论文撰写系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前一键全自动生成模式改为 5 步向导式交互流程，每步暂停等待用户审核确认

**Architecture:** 改造 Project.tsx 为向导容器，左侧步骤导航 + 右侧步骤内容区。后端新增分步执行 API，每步独立调用对应 Agent。AIGC 降痕以提示词形式集成到 Mimo 写作输入，前端仅展示检测结果。

**Tech Stack:** React + Zustand + TypeScript (前端), Express + TypeScript (后端), DeepSeek flash (light tier) + Mimo-V2.5-Pro (heavy tier)

---

## Task 1: 后端 — 修改 LLM Tier 配置

**Files:**
- Modify: `api/services/llmService.ts:294-301`

- [ ] **Step 1: 将 light tier 从 Volcengine 改为 DeepSeek flash**

将 light tier 配置改为使用 DeepSeek API（复用 DEEPSEEK_API_KEY），模型为 `deepseek-chat`（即 DeepSeek-V4-Flash）：

```typescript
light: {
  baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  model: process.env.DEEPSEEK_FLASH_MODEL || 'deepseek-chat',
  maxTokens: 2048,
  temperature: 0.3,
  timeout: 120000,
},
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 2: 后端 — projectService 新增步骤数据存储

**Files:**
- Modify: `api/services/projectService.ts`

- [ ] **Step 1: 在 projectService.ts 末尾添加 stepDataMap 和相关函数**

在文件末尾（`getProgress` 函数之后）添加：

```typescript
const stepDataMap = new Map<string, Map<string, unknown>>()

export function setStepData(projectId: string, step: string, data: unknown): void {
  if (!stepDataMap.has(projectId)) {
    stepDataMap.set(projectId, new Map())
  }
  stepDataMap.get(projectId)!.set(step, data)
}

export function getStepData(projectId: string, step: string): unknown | null {
  return stepDataMap.get(projectId)?.get(step) || null
}

export function clearStepDataAfter(projectId: string, afterStep: number): void {
  const stepNames = ['keywords', 'search', 'extract', 'write', 'complete']
  for (let i = afterStep; i < stepNames.length; i++) {
    stepDataMap.get(projectId)?.delete(stepNames[i])
  }
  if (afterStep <= 4) {
    sections.set(projectId, [])
    referencesMap.set(projectId, [])
  }
  if (afterStep <= 3) {
    progressMap.set(projectId, { stage: 'keyword_extracting', progress: 0, message: '' })
  }
  if (afterStep <= 2) {
    keywordsMap.set(projectId, [])
  }
  if (afterStep <= 1) {
    papers.set(projectId, [])
  }
}

export function getViewpoints(projectId: string): string[] {
  const data = stepDataMap.get(projectId)?.get('extract')
  if (data && typeof data === 'object' && data !== null && 'viewpoints' in data) {
    return (data as { viewpoints: string[] }).viewpoints
  }
  return []
}

export function setViewpoints(projectId: string, viewpoints: string[]): void {
  const existing = (stepDataMap.get(projectId)?.get('extract') || {}) as Record<string, unknown>
  setStepData(projectId, 'extract', { ...existing, viewpoints })
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 3: 后端 — 新增分步执行 API 路由

**Files:**
- Create: `api/routes/generateSteps.ts`
- Modify: `api/app.ts`

- [ ] **Step 1: 创建 `api/routes/generateSteps.ts`**

```typescript
import { Router, type Request, type Response } from 'express'
import * as projectService from '../services/projectService.js'
import * as keywordAgent from '../agents/keywordAgent.js'
import * as sectionPlanner from '../agents/sectionPlanner.js'
import * as searchAgent from '../agents/searchAgent.js'
import * as parseAgent from '../agents/parseAgent.js'
import * as extractAgent from '../agents/extractAgent.js'
import * as writingAgent from '../agents/writingAgent.js'
import * as citationAgent from '../agents/citationAgent.js'
import * as integrityAgent from '../agents/integrityAgent.js'
import * as chartAgent from '../agents/chartAgent.js'
import * as formatAgent from '../agents/formatAgent.js'
import * as aigcReductionAgent from '../agents/aigcReductionAgent.js'
import * as paperLibraryService from '../services/paperLibraryService.js'
import { PAPER_TYPE_SECTIONS } from '../agents/researchSkillGuidance.js'
import { DEFAULT_SECTIONS } from '../../shared/types.js'
import type { CitationFormat, SectionConfig, PaperType } from '../../shared/types.js'

const router = Router()

router.post('/keywords', async (req: Request, res: Response): Promise<void> => {
  const { projectId, topic, description, language, totalWordCount, paperType } = req.body as {
    projectId: string
    topic: string
    description?: string
    language?: 'en' | 'zh'
    totalWordCount?: number
    paperType?: PaperType
  }

  if (!projectId || !topic) {
    res.status(400).json({ success: false, error: 'projectId and topic are required' })
    return
  }

  const project = projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }

  try {
    projectService.setProgress(projectId, { stage: 'keyword_extracting', progress: 5, message: '正在提取研究关键词...' })
    const result = await keywordAgent.execute(topic, description || '')
    const allKeywords = [...result.mainKeywords, ...result.secondaryKeywords]
    projectService.setKeywords(projectId, allKeywords)

    const lang: 'en' | 'zh' = language || 'zh'
    const wordCount = totalWordCount || 5000
    const pType: PaperType = paperType || 'graduation'

    let config: SectionConfig[] = []
    if (pType && PAPER_TYPE_SECTIONS[pType]) {
      const typeSections = PAPER_TYPE_SECTIONS[pType]
      const totalTypeWords = typeSections.reduce((sum, s) => sum + s.wordCount, 0)
      const ratio = wordCount / totalTypeWords
      config = typeSections.map((s, i) => ({
        type: s.type,
        title: s.title,
        enabled: true,
        wordCount: Math.max(100, Math.round(s.wordCount * ratio)),
        order: i,
      }))
    } else {
      config = await sectionPlanner.execute(topic, description || '', wordCount, lang)
    }

    projectService.setSectionConfig(projectId, config)

    const totalPlannedWords = config.reduce((sum, section) => sum + section.wordCount, 0)
    if (totalPlannedWords > 0 && wordCount > 0) {
      const ratio = wordCount / totalPlannedWords
      config = config.map((section) => ({
        ...section,
        wordCount: Math.max(100, Math.round(section.wordCount * ratio)),
      }))
    }
    projectService.setSectionConfig(projectId, config)

    projectService.setStepData(projectId, 'keywords', {
      keywords: allKeywords,
      mainKeywords: result.mainKeywords,
      secondaryKeywords: result.secondaryKeywords,
      researchFields: result.researchFields,
      sectionConfig: config,
    })

    projectService.setProgress(projectId, {
      stage: 'keyword_extracting',
      progress: 12,
      message: `已提取 ${allKeywords.length} 个关键词，规划 ${config.length} 个章节`,
    })

    res.json({
      success: true,
      data: {
        keywords: allKeywords,
        mainKeywords: result.mainKeywords,
        secondaryKeywords: result.secondaryKeywords,
        researchFields: result.researchFields,
        sectionConfig: config,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[StepKeywords] Error:', msg)
    res.status(500).json({ success: false, error: msg })
  }
})

router.post('/search', async (req: Request, res: Response): Promise<void> => {
  const { projectId, keywords, topic } = req.body as {
    projectId: string
    keywords?: string[]
    topic?: string
  }

  if (!projectId) {
    res.status(400).json({ success: false, error: 'projectId is required' })
    return
  }

  const project = projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }

  try {
    projectService.setProgress(projectId, { stage: 'searching', progress: 15, message: '正在检索学术文献...' })

    const searchKeywords = keywords || projectService.getKeywords(projectId)
    const searchTopic = topic || project.topic
    const papers = await searchAgent.execute(searchTopic, searchKeywords)
    projectService.addPapers(projectId, papers)

    const allPapers = projectService.getPapers(projectId)
    paperLibraryService.assignCitationNumbers(projectId, allPapers)

    for (const paper of projectService.getPapers(projectId)) {
      if ((paper.relevanceScore || 0) >= 0.5) {
        paper.selected = true
      }
    }

    projectService.setProgress(projectId, { stage: 'parsing', progress: 30, message: '正在解析文献元数据...' })
    const enriched = await parseAgent.execute(projectService.getPapers(projectId))
    projectService.addPapers(projectId, enriched)

    const finalPapers = projectService.getPapers(projectId)
    const selectedCount = finalPapers.filter(p => p.selected).length

    projectService.setStepData(projectId, 'search', { papers: finalPapers })
    projectService.setProgress(projectId, {
      stage: 'parsing',
      progress: 38,
      message: `检索到 ${finalPapers.length} 篇文献，已筛选 ${selectedCount} 篇`,
    })

    res.json({
      success: true,
      data: { papers: finalPapers },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[StepSearch] Error:', msg)
    res.status(500).json({ success: false, error: msg })
  }
})

router.post('/extract', async (req: Request, res: Response): Promise<void> => {
  const { projectId, paperIds, topic } = req.body as {
    projectId: string
    paperIds?: string[]
    topic?: string
  }

  if (!projectId) {
    res.status(400).json({ success: false, error: 'projectId is required' })
    return
  }

  const project = projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }

  try {
    projectService.setProgress(projectId, { stage: 'extracting', progress: 40, message: '正在提取研究观点...' })

    let papersToUse = projectService.getSelectedPapers(projectId)
    if (papersToUse.length === 0) {
      papersToUse = projectService.getPapers(projectId)
    }
    if (paperIds && paperIds.length > 0) {
      const allPapers = projectService.getPapers(projectId)
      papersToUse = allPapers.filter(p => paperIds.includes(p.id))
    }

    if (papersToUse.length === 0) {
      res.json({ success: true, data: { viewpoints: [] } })
      return
    }

    const viewpoints = await extractAgent.execute(papersToUse, topic || project.topic)

    projectService.setStepData(projectId, 'extract', { viewpoints })
    projectService.setProgress(projectId, {
      stage: 'extracting',
      progress: 48,
      message: `已提取 ${viewpoints.length} 个观点`,
    })

    res.json({
      success: true,
      data: { viewpoints },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[StepExtract] Error:', msg)
    res.status(500).json({ success: false, error: msg })
  }
})

router.post('/write', async (req: Request, res: Response): Promise<void> => {
  const {
    projectId, viewpoints, paperIds, sectionConfig, citationFormat,
    language, totalWordCount, paperType, includeToc,
  } = req.body as {
    projectId: string
    viewpoints?: string[]
    paperIds?: string[]
    sectionConfig?: SectionConfig[]
    citationFormat?: CitationFormat
    language?: 'en' | 'zh'
    totalWordCount?: number
    paperType?: PaperType
    includeToc?: boolean
  }

  if (!projectId) {
    res.status(400).json({ success: false, error: 'projectId is required' })
    return
  }

  const project = projectService.getProject(projectId)
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' })
    return
  }

  try {
    const format: CitationFormat = citationFormat || 'gbt'
    const lang: 'en' | 'zh' = language || 'zh'
    const wordCount = totalWordCount || 5000
    const pType: PaperType = paperType || 'graduation'
    const toc = includeToc !== undefined ? includeToc : true

    let config = sectionConfig && sectionConfig.length > 0
      ? sectionConfig
      : projectService.getSectionConfig(projectId)
    if (config.length === 0) {
      config = DEFAULT_SECTIONS
    }
    projectService.setSectionConfig(projectId, config)

    let papersToUse = projectService.getSelectedPapers(projectId)
    if (papersToUse.length === 0) {
      papersToUse = projectService.getPapers(projectId)
    }
    if (paperIds && paperIds.length > 0) {
      const allPapers = projectService.getPapers(projectId)
      papersToUse = allPapers.filter(p => paperIds.includes(p.id))
    }

    let viewpointsToUse = viewpoints || projectService.getViewpoints(projectId)
    if (viewpointsToUse.length === 0) {
      const stepData = projectService.getStepData(projectId, 'extract')
      if (stepData && typeof stepData === 'object' && stepData !== null && 'viewpoints' in stepData) {
        viewpointsToUse = (stepData as { viewpoints: string[] }).viewpoints
      }
    }

    if (papersToUse.length === 0) {
      res.status(400).json({ success: false, error: 'No papers available for writing' })
      return
    }

    projectService.setProgress(projectId, { stage: 'writing', progress: 50, message: '正在撰写论文...' })
    projectService.updateProjectStatus(projectId, 'generating')

    const generatedSections = await writingAgent.execute(
      viewpointsToUse, project.topic, format, papersToUse, config, lang,
      (sectionTitle, _sectionIndex, totalSections, completedCount) => {
        const sectionProgress = 50 + Math.floor((completedCount / totalSections) * 15)
        projectService.setProgress(projectId, {
          stage: 'writing', progress: sectionProgress,
          message: `正在撰写：${sectionTitle}（${completedCount}/${totalSections}）`,
        })
      },
      wordCount, pType
    )
    projectService.setGeneratedSections(projectId, generatedSections.map(s => ({ ...s, projectId })))

    projectService.setProgress(projectId, { stage: 'citing', progress: 70, message: '正在格式化引用...' })
    const citeResult = await citationAgent.execute(generatedSections, papersToUse, format)
    projectService.setGeneratedSections(projectId, citeResult.sections.map(s => ({ ...s, projectId })))
    projectService.setReferences(projectId, citeResult.references)

    projectService.setProgress(projectId, { stage: 'integrity_reviewing', progress: 79, message: '正在审核完整性...' })
    const integrityReport = await integrityAgent.execute(citeResult.sections, papersToUse, citeResult.references)

    let aigcPatternCount = 0
    try {
      const { detectAigcPatterns } = await import('../agents/aigcReductionAgent.js')
      for (const section of citeResult.sections) {
        const patterns = detectAigcPatterns(section.content)
        aigcPatternCount += patterns.reduce((sum, p) => sum + p.count, 0)
      }
    } catch { /* ignore */ }

    projectService.setProgress(projectId, { stage: 'charting', progress: 86, message: '正在生成图表...' })
    const charts = await chartAgent.execute(citeResult.sections, papersToUse, project.topic)
    const sortedSections = [...citeResult.sections].sort((a, b) => a.order - b.order)
    const sectionIndexMap = new Map(sortedSections.map((s, i) => [s.order, i]))
    const updatedCharts = charts.map(c => {
      const idx = sectionIndexMap.get(c.position)
      return idx !== undefined ? { ...c, position: idx } : c
    })
    const updatedSections = citeResult.sections.map(s => {
      const idx = sectionIndexMap.get(s.order)
      return { ...s, charts: idx === undefined ? [] : updatedCharts.filter(c => c.position === idx) }
    })
    projectService.setGeneratedSections(projectId, updatedSections.map(s => ({ ...s, projectId })))

    projectService.setProgress(projectId, { stage: 'formatting', progress: 92, message: '正在排版...' })
    const formatResult = await formatAgent.execute(updatedSections, citeResult.references, toc)

    projectService.setStepData(projectId, 'write', {
      sections: updatedSections,
      references: citeResult.references,
      integrityReport,
      aigcPatternCount,
      formattedContent: formatResult.content,
    })

    projectService.setProgress(projectId, {
      stage: 'formatting', progress: 100,
      message: '论文撰写完成',
      partialContent: formatResult.content,
    })
    projectService.updateProjectStatus(projectId, 'completed')

    res.json({
      success: true,
      data: {
        sections: updatedSections,
        references: citeResult.references,
        integrityReport,
        aigcPatternCount,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[StepWrite] Error:', msg)
    projectService.updateProjectStatus(projectId, 'draft')
    res.status(500).json({ success: false, error: msg })
  }
})

router.post('/confirm', (req: Request, res: Response): void => {
  const { projectId, step, data } = req.body as {
    projectId: string
    step: number
    data?: Record<string, unknown>
  }

  if (!projectId || !step) {
    res.status(400).json({ success: false, error: 'projectId and step are required' })
    return
  }

  const stepNames = ['keywords', 'search', 'extract', 'write', 'complete']
  const stepName = stepNames[step - 1]
  if (!stepName) {
    res.status(400).json({ success: false, error: 'Invalid step number' })
    return
  }

  if (data) {
    projectService.setStepData(projectId, stepName, data)
  }

  if (step === 1 && data?.keywords) {
    projectService.setKeywords(projectId, data.keywords as string[])
  }
  if (step === 1 && data?.sectionConfig) {
    projectService.setSectionConfig(projectId, data.sectionConfig as SectionConfig[])
  }
  if (step === 2 && data?.selectedPaperIds) {
    projectService.selectPapersByIds(projectId, data.selectedPaperIds as string[])
  }
  if (step === 3 && data?.viewpoints) {
    projectService.setViewpoints(projectId, data.viewpoints as string[])
  }

  res.json({ success: true })
})

router.post('/rollback', (req: Request, res: Response): void => {
  const { projectId, step } = req.body as { projectId: string; step: number }

  if (!projectId || !step) {
    res.status(400).json({ success: false, error: 'projectId and step are required' })
    return
  }

  projectService.clearStepDataAfter(projectId, step)

  const clearedSteps = []
  const stepNames = ['keywords', 'search', 'extract', 'write', 'complete']
  for (let i = step; i < stepNames.length; i++) {
    clearedSteps.push(i + 1)
  }

  res.json({ success: true, clearedSteps })
})

export default router
```

- [ ] **Step 2: 在 `api/app.ts` 中注册新路由**

在 import 区域添加：
```typescript
import generateStepsRoutes from './routes/generateSteps.js'
```

在路由注册区域添加：
```typescript
app.use('/api/generate/step', generateStepsRoutes)
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 4: 后端 — 图片上传 API

**Files:**
- Modify: `api/app.ts`
- Modify: `api/server.ts`

- [ ] **Step 1: 在 `api/server.ts` 中创建 uploads 目录并添加静态文件服务**

在 `import` 区域添加：
```typescript
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
```

在 `await initializeDatabase()` 之前添加：
```typescript
const uploadsDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true })
}
```

- [ ] **Step 2: 在 `api/app.ts` 中添加 multer 和静态文件服务**

在 import 区域添加：
```typescript
import multer from 'multer'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
```

在 `app.use(cors())` 之后添加：
```typescript
const uploadsDir = join(process.cwd(), 'uploads')
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop() || 'png'
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

app.use('/uploads', express.static(uploadsDir))

app.post('/api/upload/image', upload.single('image'), (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' })
    return
  }
  const url = `/uploads/${req.file.filename}`
  res.json({ success: true, data: { url, filename: req.file.filename } })
})
```

- [ ] **Step 3: 安装 multer 依赖**

Run: `npm install multer @types/multer`

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 5: 后端 — AIGC 降痕提示词集成到写作

**Files:**
- Modify: `api/agents/writingAgent.ts:125-148`
- Modify: `api/agents/researchSkillGuidance.ts:24-32`

- [ ] **Step 1: 在 `researchSkillGuidance.ts` 的 WRITING_QUALITY_PROTOCOL 中添加反空段落规则**

在 `WRITING_QUALITY_PROTOCOL` 字符串末尾（`- Do not include LaTeX commands...` 之后）添加：

```
- NEVER produce a section that contains only a heading and 1-2 generic sentences. Every section must have substantive, developed content with multiple paragraphs of analysis.
- NEVER pad content with filler to meet word counts. If a section naturally requires fewer words, write fewer words rather than inflating with repetition.
- Dynamically allocate word counts based on content complexity: give more space to sections with richer evidence and analysis, less to sections that are naturally concise. Each section must have a minimum of 100 words of substantive content.
```

- [ ] **Step 2: 在 `writingAgent.ts` 的系统提示词中显式注入 AIGC_REDUCTION_PROTOCOL**

在 `writingAgent.ts` 的 import 区域添加：
```typescript
import { AIGC_REDUCTION_PROTOCOL } from './researchSkillGuidance.js'
```

修改 `systemPrompt` 构建部分（约第 125 行），在 `buildResearchSystemPrompt(...)` 调用之后、`Section task:` 之前，添加 AIGC 降痕提示词：

将：
```typescript
const systemPrompt = `${buildResearchSystemPrompt(
  'an expert academic writer using the Academic Research Skills writing and integrity protocol',
  language,
  paperType
)}

Section task:
```

改为：
```typescript
const systemPrompt = `${buildResearchSystemPrompt(
  'an expert academic writer using the Academic Research Skills writing and integrity protocol',
  language,
  paperType
)}

${AIGC_REDUCTION_PROTOCOL}

Section task:
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 6: 前端 — 共享类型更新

**Files:**
- Modify: `shared/types.ts`

- [ ] **Step 1: 在 `shared/types.ts` 末尾添加向导步骤相关类型**

在文件末尾添加：

```typescript
export type WizardStep = 1 | 2 | 3 | 4 | 5

export type WizardStepStatus = 'pending' | 'running' | 'review' | 'confirmed'

export interface WizardState {
  currentStep: WizardStep
  stepStatuses: Record<WizardStep, WizardStepStatus>
}

export interface StepKeywordsData {
  keywords: string[]
  mainKeywords: string[]
  secondaryKeywords: string[]
  researchFields: string[]
  sectionConfig: SectionConfig[]
}

export interface StepSearchData {
  papers: Paper[]
}

export interface StepExtractData {
  viewpoints: string[]
}

export interface StepWriteData {
  sections: GeneratedSection[]
  references: Reference[]
  integrityReport: { issues: Array<{ severity: string; category: string; message: string }>; summary: string; passed: boolean }
  aigcPatternCount: number
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 7: 前端 — Store 更新

**Files:**
- Modify: `src/store/useAppStore.ts`

- [ ] **Step 1: 在 useAppStore 中添加向导相关状态**

在 import 中添加 `WizardStep, WizardStepStatus`：
```typescript
import type {
  Project, Paper, GeneratedSection, GenerationProgress, CitationFormat,
  SectionConfig, Reference, PaperType, Workspace, WizardStep, WizardStepStatus,
} from "../../shared/types";
```

在 `AppState` 接口中添加（在 `currentWorkspaceId` 之后）：

```typescript
wizardStep: WizardStep;
setWizardStep: (step: WizardStep) => void;
wizardStepStatuses: Record<WizardStep, WizardStepStatus>;
setWizardStepStatus: (step: WizardStep, status: WizardStepStatus) => void;
viewpoints: string[];
setViewpoints: (viewpoints: string[]) => void;
selectedViewpointIndices: Set<number>;
toggleViewpointSelection: (index: number) => void;
selectAllViewpoints: () => void;
deselectAllViewpoints: () => void;
uploadedImages: Record<string, string>;
setUploadedImage: (placeholderId: string, imageUrl: string) => void;
```

在 `create<AppState>((set) => ({...}))` 中添加（在 `setCurrentWorkspaceId` 之后）：

```typescript
wizardStep: 1,
setWizardStep: (step) => set({ wizardStep: step }),
wizardStepStatuses: { 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending' },
setWizardStepStatus: (step, status) =>
  set((state) => ({
    wizardStepStatuses: { ...state.wizardStepStatuses, [step]: status },
  })),
viewpoints: [],
setViewpoints: (viewpoints) => set({ viewpoints }),
selectedViewpointIndices: new Set(),
toggleViewpointSelection: (index) =>
  set((state) => {
    const next = new Set(state.selectedViewpointIndices)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    return { selectedViewpointIndices: next }
  }),
selectAllViewpoints: () =>
  set((state) => ({
    selectedViewpointIndices: new Set(state.viewpoints.map((_, i) => i)),
  })),
deselectAllViewpoints: () => set({ selectedViewpointIndices: new Set() }),
uploadedImages: {},
setUploadedImage: (placeholderId, imageUrl) =>
  set((state) => ({
    uploadedImages: { ...state.uploadedImages, [placeholderId]: imageUrl },
  })),
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 8: 前端 — API 函数更新

**Files:**
- Modify: `src/utils/api.ts`

- [ ] **Step 1: 在 `api.ts` 中添加分步执行 API 函数**

在 import 中添加新类型：
```typescript
import type {
  CitationChainLink, CitationFormat, ExportFormat, GeneratedSection,
  GenerationProgress, KnowledgeEntry, Paper, PaperType, Project, Reference,
  SectionConfig, WorkflowState, Workspace, StepKeywordsData, StepSearchData,
  StepExtractData, StepWriteData,
} from "../../shared/types";
```

在文件末尾添加：

```typescript
export async function stepKeywords(params: {
  projectId: string; topic: string; description?: string;
  language?: 'en' | 'zh'; totalWordCount?: number; paperType?: PaperType;
}) {
  return request<StepKeywordsData>('/generate/step/keywords', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function stepSearch(params: {
  projectId: string; keywords?: string[]; topic?: string;
}) {
  return request<StepSearchData>('/generate/step/search', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function stepExtract(params: {
  projectId: string; paperIds?: string[]; topic?: string;
}) {
  return request<StepExtractData>('/generate/step/extract', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function stepWrite(params: {
  projectId: string; viewpoints?: string[]; paperIds?: string[];
  sectionConfig?: SectionConfig[]; citationFormat?: CitationFormat;
  language?: 'en' | 'zh'; totalWordCount?: number;
  paperType?: PaperType; includeToc?: boolean;
}) {
  return request<StepWriteData>('/generate/step/write', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function stepConfirm(projectId: string, step: number, data?: Record<string, unknown>) {
  return request<{ success: boolean }>('/generate/step/confirm', {
    method: 'POST',
    body: JSON.stringify({ projectId, step, data }),
  });
}

export async function stepRollback(projectId: string, step: number) {
  return request<{ success: boolean; clearedSteps: number[] }>('/generate/step/rollback', {
    method: 'POST',
    body: JSON.stringify({ projectId, step }),
  });
}

export async function uploadImage(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch('/api/upload/image', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  const json = await res.json();
  return json.data;
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

---

## Task 9: 前端 — StepSidebar 组件

**Files:**
- Create: `src/components/StepSidebar.tsx`

- [ ] **Step 1: 创建 StepSidebar 组件**

```tsx
import { motion } from "framer-motion";
import { KeyRound, Search, FlaskConical, PenTool, CheckCircle2, Loader2, Circle } from "lucide-react";
import type { WizardStep, WizardStepStatus } from "../../shared/types";

const steps: { step: WizardStep; label: string; icon: typeof KeyRound }[] = [
  { step: 1, label: "关键词提取", icon: KeyRound },
  { step: 2, label: "文献检索", icon: Search },
  { step: 3, label: "观点提取", icon: FlaskConical },
  { step: 4, label: "论文撰写", icon: PenTool },
  { step: 5, label: "完成", icon: CheckCircle2 },
];

interface StepSidebarProps {
  currentStep: WizardStep;
  stepStatuses: Record<WizardStep, WizardStepStatus>;
  onStepClick: (step: WizardStep) => void;
}

export default function StepSidebar({ currentStep, stepStatuses, onStepClick }: StepSidebarProps) {
  return (
    <div className="w-56 border-r border-navy-100 bg-warmgray/30 flex flex-col py-6 px-3">
      <h3 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-4 px-2">
        撰写流程
      </h3>
      <div className="space-y-1">
        {steps.map(({ step, label, icon: Icon }) => {
          const status = stepStatuses[step];
          const isActive = step === currentStep;
          const isCompleted = status === "confirmed";
          const isClickable = isCompleted || step <= currentStep;

          return (
            <motion.button
              key={step}
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                isActive
                  ? "bg-cyan/10 text-cyan border border-cyan/20"
                  : isCompleted
                  ? "text-navy-600 hover:bg-navy-50 border border-transparent"
                  : isClickable
                  ? "text-navy-500 hover:bg-navy-50 border border-transparent"
                  : "text-navy-300 border border-transparent cursor-not-allowed"
              }`}
              whileHover={isClickable ? { x: 2 } : {}}
              whileTap={isClickable ? { scale: 0.98 } : {}}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isActive
                    ? "bg-cyan/20 border-2 border-cyan"
                    : isCompleted
                    ? "bg-cyan/10 border-2 border-cyan/40"
                    : "bg-navy-50 border-2 border-navy-200"
                }`}
              >
                {status === "running" ? (
                  <Loader2 size={14} className="text-cyan animate-spin" />
                ) : isCompleted ? (
                  <CheckCircle2 size={14} className="text-cyan-600" />
                ) : isActive ? (
                  <Icon size={14} className="text-cyan" />
                ) : (
                  <Circle size={14} className="text-navy-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isActive ? "text-cyan" : ""}`}>
                  {label}
                </p>
              </div>
              <span className="text-[10px] text-navy-300">{step}/5</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Task 10: 前端 — KeywordTag 组件

**Files:**
- Create: `src/components/KeywordTag.tsx`

- [ ] **Step 1: 创建 KeywordTag 组件**

```tsx
import { useState } from "react";
import { X, Pencil } from "lucide-react";

interface KeywordTagProps {
  text: string;
  color?: "blue" | "gray" | "green";
  onRemove?: () => void;
  onEdit?: (newText: string) => void;
}

const colorClasses = {
  blue: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  gray: "bg-navy-50 text-navy-600 border-navy-200 hover:bg-navy-100",
  green: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
};

export default function KeywordTag({ text, color = "blue", onRemove, onEdit }: KeywordTagProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  const handleDoubleClick = () => {
    if (onEdit) {
      setEditing(true);
      setEditText(text);
    }
  };

  const handleBlur = () => {
    setEditing(false);
    if (editText.trim() && editText.trim() !== text) {
      onEdit?.(editText.trim());
    } else {
      setEditText(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleBlur();
    if (e.key === "Escape") {
      setEditText(text);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        className="px-2 py-0.5 text-sm border border-cyan rounded bg-white outline-none focus:ring-1 focus:ring-cyan/30 w-24"
      />
    );
  }

  return (
    <span
      onDoubleClick={handleDoubleClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${colorClasses[color]}`}
    >
      {text}
      {onEdit && (
        <button onClick={handleDoubleClick} className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
          <Pencil size={10} />
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-red-500 transition-colors">
          <X size={12} />
        </button>
      )}
    </span>
  );
}
```

---

## Task 11: 前端 — ViewpointCard 组件

**Files:**
- Create: `src/components/ViewpointCard.tsx`

- [ ] **Step 1: 创建 ViewpointCard 组件**

```tsx
import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";

interface ViewpointCardProps {
  text: string;
  index: number;
  selected: boolean;
  onToggleSelect: (index: number) => void;
  onEdit: (index: number, newText: string) => void;
  onDelete: (index: number) => void;
}

export default function ViewpointCard({ text, index, selected, onToggleSelect, onEdit, onDelete }: ViewpointCardProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  const handleSave = () => {
    if (editText.trim()) {
      onEdit(index, editText.trim());
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setEditText(text);
    setEditing(false);
  };

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        selected
          ? "border-cyan/30 bg-cyan/5"
          : "border-navy-100 bg-white hover:border-navy-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggleSelect(index)}
          className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
            selected
              ? "bg-cyan border-cyan text-white"
              : "border-navy-300 hover:border-cyan"
          }`}
        >
          {selected && <Check size={12} />}
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full text-sm text-navy-600 leading-relaxed p-2 border border-navy-200 rounded-md outline-none focus:ring-1 focus:ring-cyan/30 resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={handleSave} className="text-xs text-cyan hover:text-cyan-600 font-medium">保存</button>
                <button onClick={handleCancel} className="text-xs text-navy-400 hover:text-navy-600">取消</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-navy-600 leading-relaxed">{text}</p>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { setEditing(true); setEditText(text); }}
              className="p-1 text-navy-300 hover:text-cyan transition-colors"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => onDelete(index)}
              className="p-1 text-navy-300 hover:text-red-500 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Task 12: 前端 — ImageUploader 组件

**Files:**
- Create: `src/components/ImageUploader.tsx`

- [ ] **Step 1: 创建 ImageUploader 组件**

```tsx
import { useRef } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { uploadImage } from "@/utils/api";

interface ImageUploaderProps {
  placeholderId: string;
  currentImageUrl?: string;
  onUploaded: (placeholderId: string, imageUrl: string) => void;
}

export default function ImageUploader({ placeholderId, currentImageUrl, onUploaded }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadImage(file);
      onUploaded(placeholderId, result.url);
    } catch (err) {
      console.error("Image upload failed:", err);
    }
  };

  if (currentImageUrl) {
    return (
      <div className="relative group mt-3 border border-navy-100 rounded-lg overflow-hidden">
        <img src={currentImageUrl} alt="uploaded" className="max-w-full object-contain" />
        <button
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 bg-navy-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm"
        >
          <Upload size={16} className="mr-2" />
          替换图片
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>
    );
  }

  return (
    <button
      onClick={() => inputRef.current?.click()}
      className="mt-3 w-full border-2 border-dashed border-navy-200 rounded-lg p-4 flex flex-col items-center justify-center text-navy-300 hover:border-cyan/40 hover:text-cyan transition-colors"
    >
      <ImageIcon size={24} className="mb-1" />
      <span className="text-xs">点击上传图片</span>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
    </button>
  );
}
```

---

## Task 13: 前端 — StepKeywords 组件

**Files:**
- Create: `src/components/steps/StepKeywords.tsx`

- [ ] **Step 1: 创建 StepKeywords 组件**

```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import KeywordTag from "@/components/KeywordTag";
import type { SectionConfig, PaperType } from "../../../shared/types";

interface StepKeywordsProps {
  projectId: string;
  topic: string;
  description: string;
  language: "en" | "zh";
  totalWordCount: number;
  paperType: PaperType;
  isRunning: boolean;
  onRun: () => Promise<void>;
  keywords: string[];
  mainKeywords: string[];
  secondaryKeywords: string[];
  researchFields: string[];
  sectionConfig: SectionConfig[];
  onKeywordsChange: (keywords: string[], main: string[], secondary: string[], fields: string[]) => void;
  onSectionConfigChange: (config: SectionConfig[]) => void;
}

export default function StepKeywords({
  isRunning, onRun, keywords, mainKeywords, secondaryKeywords,
  researchFields, sectionConfig, onKeywordsChange, onSectionConfigChange,
}: StepKeywordsProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [showSections, setShowSections] = useState(false);

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    const updated = [...keywords, newKeyword.trim()];
    onKeywordsChange(updated, mainKeywords, secondaryKeywords, researchFields);
    setNewKeyword("");
  };

  const handleRemoveKeyword = (kw: string) => {
    const updated = keywords.filter(k => k !== kw);
    const main = mainKeywords.filter(k => k !== kw);
    const secondary = secondaryKeywords.filter(k => k !== kw);
    onKeywordsChange(updated, main, secondary, researchFields);
  };

  const handleEditKeyword = (oldText: string, newText: string) => {
    const updated = keywords.map(k => k === oldText ? newText : k);
    const main = mainKeywords.map(k => k === oldText ? newText : k);
    const secondary = secondaryKeywords.map(k => k === oldText ? newText : k);
    onKeywordsChange(updated, main, secondary, researchFields);
  };

  const handleToggleSection = (index: number) => {
    const updated = sectionConfig.map((s, i) =>
      i === index ? { ...s, enabled: !s.enabled } : s
    );
    onSectionConfigChange(updated);
  };

  const handleSectionWordCount = (index: number, wordCount: number) => {
    const updated = sectionConfig.map((s, i) =>
      i === index ? { ...s, wordCount: Math.max(50, wordCount) } : s
    );
    onSectionConfigChange(updated);
  };

  if (keywords.length === 0 && !isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold text-navy-700 mb-2">第一步：提取关键词</h2>
          <p className="text-sm text-navy-400 mb-6">AI 将根据您的研究主题提取关键词并规划论文结构</p>
          <button onClick={onRun} className="btn-primary flex items-center gap-2 mx-auto">
            <Plus size={16} />
            开始提取关键词
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {isRunning && (
          <div className="flex items-center gap-3 text-cyan">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">正在提取关键词和规划章节...</span>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-navy-700 mb-3">核心关键词</h3>
          <div className="flex flex-wrap gap-2">
            {mainKeywords.map((kw) => (
              <KeywordTag key={kw} text={kw} color="blue" onRemove={() => handleRemoveKeyword(kw)} onEdit={(t) => handleEditKeyword(kw, t)} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-navy-700 mb-3">次要关键词</h3>
          <div className="flex flex-wrap gap-2">
            {secondaryKeywords.map((kw) => (
              <KeywordTag key={kw} text={kw} color="gray" onRemove={() => handleRemoveKeyword(kw)} onEdit={(t) => handleEditKeyword(kw, t)} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-navy-700 mb-3">研究领域</h3>
          <div className="flex flex-wrap gap-2">
            {researchFields.map((field) => (
              <KeywordTag key={field} text={field} color="green" onRemove={() => handleRemoveKeyword(field)} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
            placeholder="添加关键词..."
            className="flex-1 px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-2 focus:ring-cyan/20"
          />
          <button onClick={handleAddKeyword} className="btn-secondary text-sm flex items-center gap-1">
            <Plus size={14} />
            添加
          </button>
        </div>

        <div className="border-t border-navy-100 pt-4">
          <button
            onClick={() => setShowSections(!showSections)}
            className="flex items-center gap-2 text-sm font-medium text-navy-600 hover:text-cyan transition-colors"
          >
            {showSections ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            章节规划（{sectionConfig.filter(s => s.enabled).length} 个章节）
          </button>
          {showSections && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="mt-3 space-y-2"
            >
              {sectionConfig.map((section, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-navy-50/50">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={() => handleToggleSection(i)}
                    className="w-4 h-4 accent-[#00E5C7]"
                  />
                  <span className={`text-sm flex-1 ${section.enabled ? "text-navy-700" : "text-navy-300 line-through"}`}>
                    {section.title}
                  </span>
                  <input
                    type="number"
                    value={section.wordCount}
                    onChange={(e) => handleSectionWordCount(i, parseInt(e.target.value) || 100)}
                    className="w-20 px-2 py-1 text-xs border border-navy-200 rounded text-center outline-none focus:ring-1 focus:ring-cyan/30"
                  />
                  <span className="text-xs text-navy-400">字</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Task 14: 前端 — StepSearch 组件

**Files:**
- Create: `src/components/steps/StepSearch.tsx`

- [ ] **Step 1: 创建 StepSearch 组件**

```tsx
import { useState } from "react";
import { Loader2, Plus, ExternalLink } from "lucide-react";
import PaperCard from "@/components/PaperCard";
import type { Paper } from "../../../shared/types";

interface StepSearchProps {
  isRunning: boolean;
  onRun: () => Promise<void>;
  papers: Paper[];
  onTogglePaper: (id: string) => void;
  onAddExternalPaper: (paper: Paper) => void;
}

export default function StepSearch({ isRunning, onRun, papers, onTogglePaper, onAddExternalPaper }: StepSearchProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [extTitle, setExtTitle] = useState("");
  const [extAuthors, setExtAuthors] = useState("");
  const [extAbstract, setExtAbstract] = useState("");
  const [extYear, setExtYear] = useState(new Date().getFullYear().toString());
  const [extDoi, setExtDoi] = useState("");

  const selectedCount = papers.filter(p => p.selected).length;

  const handleAddExternal = () => {
    if (!extTitle.trim()) return;
    const paper: Paper = {
      id: `ext-${Date.now()}`,
      projectId: "",
      title: extTitle.trim(),
      authors: extAuthors.split(",").map(a => a.trim()).filter(Boolean),
      year: parseInt(extYear) || new Date().getFullYear(),
      abstract: extAbstract.trim(),
      source: "crossref" as const,
      sourceId: `ext-${Date.now()}`,
      doi: extDoi.trim() || undefined,
      selected: true,
    };
    onAddExternalPaper(paper);
    setExtTitle("");
    setExtAuthors("");
    setExtAbstract("");
    setExtYear(new Date().getFullYear().toString());
    setExtDoi("");
    setShowAddForm(false);
  };

  if (papers.length === 0 && !isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold text-navy-700 mb-2">第二步：文献检索</h2>
          <p className="text-sm text-navy-400 mb-6">AI 将根据关键词在学术数据库中检索相关文献</p>
          <button onClick={onRun} className="btn-primary flex items-center gap-2 mx-auto">
            开始检索文献
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isRunning && (
        <div className="px-6 py-3 bg-cyan/5 border-b border-cyan/10 flex items-center gap-3 text-cyan">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-medium">正在检索和解析文献...</span>
        </div>
      )}

      <div className="px-6 py-3 border-b border-navy-100 flex items-center justify-between bg-ivory/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-navy-600">
            检索到 {papers.length} 篇文献
          </span>
          <span className="text-xs text-cyan bg-cyan/10 px-2 py-0.5 rounded-full">
            已选 {selectedCount} 篇
          </span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-secondary text-xs flex items-center gap-1"
        >
          <Plus size={12} />
          添加文献
        </button>
      </div>

      {showAddForm && (
        <div className="px-6 py-4 border-b border-navy-100 bg-warmgray/30 space-y-3">
          <input value={extTitle} onChange={(e) => setExtTitle(e.target.value)} placeholder="文献标题 *" className="w-full px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30" />
          <div className="flex gap-3">
            <input value={extAuthors} onChange={(e) => setExtAuthors(e.target.value)} placeholder="作者（逗号分隔）" className="flex-1 px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30" />
            <input value={extYear} onChange={(e) => setExtYear(e.target.value)} placeholder="年份" className="w-24 px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30" />
          </div>
          <textarea value={extAbstract} onChange={(e) => setExtAbstract(e.target.value)} placeholder="摘要" rows={2} className="w-full px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30 resize-none" />
          <input value={extDoi} onChange={(e) => setExtDoi(e.target.value)} placeholder="DOI（可选）" className="w-full px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30" />
          <button onClick={handleAddExternal} disabled={!extTitle.trim()} className="btn-primary text-sm">添加</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-3">
        {papers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} onToggleSelect={onTogglePaper} />
        ))}
      </div>
    </div>
  );
}
```

---

## Task 15: 前端 — StepExtract 组件

**Files:**
- Create: `src/components/steps/StepExtract.tsx`

- [ ] **Step 1: 创建 StepExtract 组件**

```tsx
import { useState } from "react";
import { Loader2, Plus, CheckSquare, Square } from "lucide-react";
import ViewpointCard from "@/components/ViewpointCard";

interface StepExtractProps {
  isRunning: boolean;
  onRun: () => Promise<void>;
  viewpoints: string[];
  selectedIndices: Set<number>;
  onToggleSelect: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onEditViewpoint: (index: number, newText: string) => void;
  onDeleteViewpoint: (index: number) => void;
  onAddViewpoint: (text: string) => void;
}

export default function StepExtract({
  isRunning, onRun, viewpoints, selectedIndices,
  onToggleSelect, onSelectAll, onDeselectAll,
  onEditViewpoint, onDeleteViewpoint, onAddViewpoint,
}: StepExtractProps) {
  const [newViewpoint, setNewViewpoint] = useState("");

  const handleAdd = () => {
    if (!newViewpoint.trim()) return;
    onAddViewpoint(newViewpoint.trim());
    setNewViewpoint("");
  };

  if (viewpoints.length === 0 && !isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold text-navy-700 mb-2">第三步：观点提取</h2>
          <p className="text-sm text-navy-400 mb-6">AI 将从选定文献中提取核心观点和研究发现</p>
          <button onClick={onRun} className="btn-primary flex items-center gap-2 mx-auto">
            开始提取观点
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isRunning && (
        <div className="px-6 py-3 bg-cyan/5 border-b border-cyan/10 flex items-center gap-3 text-cyan">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-medium">正在提取研究观点...</span>
        </div>
      )}

      <div className="px-6 py-3 border-b border-navy-100 flex items-center justify-between bg-ivory/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-navy-600">
            {viewpoints.length} 个观点
          </span>
          <span className="text-xs text-cyan bg-cyan/10 px-2 py-0.5 rounded-full">
            已选 {selectedIndices.size} 个
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSelectAll} className="text-xs text-navy-500 hover:text-cyan flex items-center gap-1">
            <CheckSquare size={12} /> 全选
          </button>
          <button onClick={onDeselectAll} className="text-xs text-navy-500 hover:text-cyan flex items-center gap-1">
            <Square size={12} /> 取消全选
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-3">
        {viewpoints.map((vp, i) => (
          <ViewpointCard
            key={i}
            text={vp}
            index={i}
            selected={selectedIndices.has(i)}
            onToggleSelect={onToggleSelect}
            onEdit={onEditViewpoint}
            onDelete={onDeleteViewpoint}
          />
        ))}
      </div>

      <div className="px-6 py-3 border-t border-navy-100 bg-ivory/50">
        <div className="flex items-center gap-2">
          <input
            value={newViewpoint}
            onChange={(e) => setNewViewpoint(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="手动添加观点..."
            className="flex-1 px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30"
          />
          <button onClick={handleAdd} disabled={!newViewpoint.trim()} className="btn-secondary text-sm flex items-center gap-1">
            <Plus size={14} />
            添加
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 16: 前端 — StepWriting 组件

**Files:**
- Create: `src/components/steps/StepWriting.tsx`

- [ ] **Step 1: 创建 StepWriting 组件**

```tsx
import { Loader2, ShieldCheck, ScanSearch } from "lucide-react";
import ContentEditor from "@/components/ContentEditor";
import ImageUploader from "@/components/ImageUploader";
import type { GeneratedSection, Reference } from "../../../shared/types";

interface StepWritingProps {
  isRunning: boolean;
  onRun: () => Promise<void>;
  sections: GeneratedSection[];
  references: Reference[];
  integrityReport: { issues: Array<{ severity: string; category: string; message: string }>; summary: string; passed: boolean } | null;
  aigcPatternCount: number | null;
  onSectionChange: (id: string, content: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  uploadedImages: Record<string, string>;
  onImageUpload: (placeholderId: string, imageUrl: string) => void;
  projectTitle?: string;
  projectKeywords?: string[];
  includeToc?: boolean;
}

export default function StepWriting({
  isRunning, onRun, sections, references, integrityReport, aigcPatternCount,
  onSectionChange, onReorder, uploadedImages, onImageUpload,
  projectTitle, projectKeywords, includeToc,
}: StepWritingProps) {
  if (sections.length === 0 && !isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold text-navy-700 mb-2">第四步：论文撰写</h2>
          <p className="text-sm text-navy-400 mb-6">AI 将根据选定观点和文献撰写完整论文</p>
          <button onClick={onRun} className="btn-primary flex items-center gap-2 mx-auto">
            开始撰写论文
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isRunning && (
        <div className="px-6 py-3 bg-cyan/5 border-b border-cyan/10 flex items-center gap-3 text-cyan">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-medium">正在撰写论文，请耐心等待...</span>
        </div>
      )}

      {!isRunning && (integrityReport || aigcPatternCount !== null) && (
        <div className="px-6 py-3 border-b border-navy-100 bg-ivory/50 flex items-center gap-4">
          {integrityReport && (
            <div className={`flex items-center gap-2 text-xs ${integrityReport.passed ? "text-green-600" : "text-amber-600"}`}>
              <ShieldCheck size={14} />
              <span>{integrityReport.passed ? "完整性审核通过" : `审核发现 ${integrityReport.issues.length} 个问题`}</span>
            </div>
          )}
          {aigcPatternCount !== null && (
            <div className={`flex items-center gap-2 text-xs ${aigcPatternCount === 0 ? "text-green-600" : "text-amber-600"}`}>
              <ScanSearch size={14} />
              <span>AIGC 检测：{aigcPatternCount === 0 ? "未发现 AI 痕迹" : `发现 ${aigcPatternCount} 处潜在痕迹（已通过提示词优化降低）`}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <ContentEditor
          sections={sections}
          onSectionChange={onSectionChange}
          onReorder={onReorder}
          projectTitle={projectTitle}
          projectKeywords={projectKeywords}
          includeToc={includeToc}
        />
      </div>
    </div>
  );
}
```

---

## Task 17: 前端 — StepComplete 组件

**Files:**
- Create: `src/components/steps/StepComplete.tsx`

- [ ] **Step 1: 创建 StepComplete 组件**

```tsx
import { Download, FileText, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { GeneratedSection, Reference } from "../../../shared/types";

interface StepCompleteProps {
  projectId: string;
  sections: GeneratedSection[];
  references: Reference[];
  totalWordCount: number;
}

export default function StepComplete({ projectId, sections, references, totalWordCount }: StepCompleteProps) {
  const navigate = useNavigate();
  const actualWords = sections.reduce((sum, s) => sum + (s.wordCount || 0), 0);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-cyan/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText size={28} className="text-cyan" />
        </div>
        <h2 className="font-serif text-xl font-semibold text-navy-700 mb-2">论文撰写完成！</h2>
        <p className="text-sm text-navy-400 mb-6">
          共 {sections.length} 个章节，{actualWords} 字（目标 {totalWordCount} 字），{references.length} 条参考文献
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate(`/export/${projectId}`)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Download size={16} />
            导出论文
          </button>
          <button
            onClick={() => navigate(`/export/${projectId}`)}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <FileDown size={16} />
            导出为 Word / PDF / LaTeX
          </button>
        </div>

        <p className="text-xs text-navy-300 mt-6">
          您可以随时回溯到之前的步骤修改内容
        </p>
      </div>
    </div>
  );
}
```

---

## Task 18: 前端 — 重构 Project.tsx

**Files:**
- Modify: `src/pages/Project.tsx`

- [ ] **Step 1: 完全重写 Project.tsx 为向导容器**

```tsx
import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Globe, Download, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import useAppStore from "@/store/useAppStore";
import StepSidebar from "@/components/StepSidebar";
import StepKeywords from "@/components/steps/StepKeywords";
import StepSearch from "@/components/steps/StepSearch";
import StepExtract from "@/components/steps/StepExtract";
import StepWriting from "@/components/steps/StepWriting";
import StepComplete from "@/components/steps/StepComplete";
import {
  fetchProject, stepKeywords, stepSearch, stepExtract, stepWrite,
  stepConfirm, stepRollback,
} from "@/utils/api";
import type { WizardStep, SectionConfig, Paper } from "../../shared/types";

export default function Project() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    projects, addProject, updateProject,
    papers, setPapers, togglePaperSelection,
    generatedSections, setGeneratedSections,
    references, setReferences,
    citationFormat, sectionConfig, setSectionConfig,
    totalWordCount, language, setLanguage,
    paperType,
    keywords: projectKeywords,
    wizardStep, setWizardStep,
    wizardStepStatuses, setWizardStepStatus,
    viewpoints, setViewpoints,
    selectedViewpointIndices, toggleViewpointSelection,
    selectAllViewpoints, deselectAllViewpoints,
    uploadedImages, setUploadedImage,
  } = useAppStore();

  const project = projects.find((item) => item.id === id);

  useEffect(() => {
    if (id && !project) {
      fetchProject(id).then((data) => {
        if (data) addProject(data);
      }).catch(() => {});
    }
  }, [id, project, addProject]);

  const [isRunning, setIsRunning] = useState(false);
  const [mainKeywords, setMainKeywords] = useState<string[]>([]);
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([]);
  const [researchFields, setResearchFields] = useState<string[]>([]);
  const [integrityReport, setIntegrityReport] = useState<{ issues: Array<{ severity: string; category: string; message: string }>; summary: string; passed: boolean } | null>(null);
  const [aigcPatternCount, setAigcPatternCount] = useState<number | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState<WizardStep | null>(null);

  const handleRunKeywords = useCallback(async () => {
    if (!id || !project) return;
    setIsRunning(true);
    setWizardStepStatus(1, "running");
    try {
      const result = await stepKeywords({
        projectId: id, topic: project.topic, description: project.description,
        language, totalWordCount, paperType,
      });
      setMainKeywords(result.mainKeywords);
      setSecondaryKeywords(result.secondaryKeywords);
      setResearchFields(result.researchFields);
      setSectionConfig(result.sectionConfig);
      setWizardStepStatus(1, "review");
    } catch (err) {
      console.error("Keywords step failed:", err);
      setWizardStepStatus(1, "pending");
    } finally {
      setIsRunning(false);
    }
  }, [id, project, language, totalWordCount, paperType, setSectionConfig, setWizardStepStatus]);

  const handleRunSearch = useCallback(async () => {
    if (!id || !project) return;
    setIsRunning(true);
    setWizardStepStatus(2, "running");
    try {
      const result = await stepSearch({
        projectId: id,
        keywords: projectKeywords,
        topic: project.topic,
      });
      setPapers(result.papers);
      setWizardStepStatus(2, "review");
    } catch (err) {
      console.error("Search step failed:", err);
      setWizardStepStatus(2, "pending");
    } finally {
      setIsRunning(false);
    }
  }, [id, project, projectKeywords, setPapers, setWizardStepStatus]);

  const handleRunExtract = useCallback(async () => {
    if (!id || !project) return;
    setIsRunning(true);
    setWizardStepStatus(3, "running");
    try {
      const selectedPaperIds = papers.filter(p => p.selected).map(p => p.id);
      const result = await stepExtract({
        projectId: id,
        paperIds: selectedPaperIds.length > 0 ? selectedPaperIds : undefined,
        topic: project.topic,
      });
      setViewpoints(result.viewpoints);
      selectAllViewpoints();
      setWizardStepStatus(3, "review");
    } catch (err) {
      console.error("Extract step failed:", err);
      setWizardStepStatus(3, "pending");
    } finally {
      setIsRunning(false);
    }
  }, [id, project, papers, setViewpoints, selectAllViewpoints, setWizardStepStatus]);

  const handleRunWrite = useCallback(async () => {
    if (!id || !project) return;
    setIsRunning(true);
    setWizardStepStatus(4, "running");
    try {
      const selectedVps = viewpoints.filter((_, i) => selectedViewpointIndices.has(i));
      const selectedPaperIds = papers.filter(p => p.selected).map(p => p.id);
      const result = await stepWrite({
        projectId: id,
        viewpoints: selectedVps,
        paperIds: selectedPaperIds,
        sectionConfig,
        citationFormat,
        language,
        totalWordCount,
        paperType,
      });
      setGeneratedSections(result.sections);
      setReferences(result.references);
      setIntegrityReport(result.integrityReport);
      setAigcPatternCount(result.aigcPatternCount);
      setWizardStepStatus(4, "review");
    } catch (err) {
      console.error("Write step failed:", err);
      setWizardStepStatus(4, "pending");
    } finally {
      setIsRunning(false);
    }
  }, [id, project, viewpoints, selectedViewpointIndices, papers, sectionConfig, citationFormat, language, totalWordCount, paperType, setGeneratedSections, setReferences, setWizardStepStatus]);

  const handleConfirm = useCallback(async () => {
    if (!id) return;
    try {
      const stepData: Record<string, unknown> = {};
      if (wizardStep === 1) {
        stepData.keywords = projectKeywords;
        stepData.sectionConfig = sectionConfig;
      } else if (wizardStep === 2) {
        stepData.selectedPaperIds = papers.filter(p => p.selected).map(p => p.id);
      } else if (wizardStep === 3) {
        stepData.viewpoints = viewpoints.filter((_, i) => selectedViewpointIndices.has(i));
      }
      await stepConfirm(id, wizardStep, stepData);
      setWizardStepStatus(wizardStep, "confirmed");
      if (wizardStep < 5) {
        setWizardStep((wizardStep + 1) as WizardStep);
      }
    } catch (err) {
      console.error("Confirm failed:", err);
    }
  }, [id, wizardStep, projectKeywords, sectionConfig, papers, viewpoints, selectedViewpointIndices, setWizardStepStatus, setWizardStep]);

  const handleGoBack = useCallback(() => {
    if (wizardStep > 1) {
      setWizardStep((wizardStep - 1) as WizardStep);
    }
  }, [wizardStep, setWizardStep]);

  const handleStepClick = useCallback((step: WizardStep) => {
    if (wizardStepStatuses[step] === "confirmed" && step !== wizardStep) {
      setShowRollbackDialog(step);
    } else if (step <= wizardStep) {
      setWizardStep(step);
    }
  }, [wizardStep, wizardStepStatuses, setWizardStep]);

  const handleRollbackConfirm = useCallback(async () => {
    if (!id || !showRollbackDialog) return;
    try {
      await stepRollback(id, showRollbackDialog);
      setWizardStep(showRollbackDialog);
      setWizardStepStatus(showRollbackDialog, "review");
      for (let s = showRollbackDialog + 1; s <= 5; s++) {
        setWizardStepStatus(s as WizardStep, "pending");
      }
      if (showRollbackDialog <= 1) {
        setPapers([]);
        setViewpoints([]);
        setGeneratedSections([]);
        setReferences([]);
      } else if (showRollbackDialog <= 2) {
        setViewpoints([]);
        setGeneratedSections([]);
        setReferences([]);
      } else if (showRollbackDialog <= 3) {
        setGeneratedSections([]);
        setReferences([]);
      }
    } catch (err) {
      console.error("Rollback failed:", err);
    }
    setShowRollbackDialog(null);
  }, [id, showRollbackDialog, setWizardStep, setWizardStepStatus, setPapers, setViewpoints, setGeneratedSections, setReferences]);

  const handleSectionChange = useCallback((sectionId: string, content: string) => {
    setGeneratedSections(generatedSections.map((s) => s.id === sectionId ? { ...s, content } : s));
  }, [generatedSections, setGeneratedSections]);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    const sorted = [...generatedSections].sort((a, b) => a.order - b.order);
    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);
    setGeneratedSections(sorted.map((s, i) => ({ ...s, order: i })));
  }, [generatedSections, setGeneratedSections]);

  const handleAddExternalPaper = useCallback((paper: Paper) => {
    setPapers([...papers, paper]);
  }, [papers, setPapers]);

  const handleEditViewpoint = useCallback((index: number, newText: string) => {
    const updated = [...viewpoints];
    updated[index] = newText;
    setViewpoints(updated);
  }, [viewpoints, setViewpoints]);

  const handleDeleteViewpoint = useCallback((index: number) => {
    const updated = viewpoints.filter((_, i) => i !== index);
    setViewpoints(updated);
  }, [viewpoints, setViewpoints]);

  const handleAddViewpoint = useCallback((text: string) => {
    setViewpoints([...viewpoints, text]);
  }, [viewpoints, setViewpoints]);

  const handleKeywordsChange = useCallback((kw: string[], main: string[], secondary: string[], fields: string[]) => {
    setMainKeywords(main);
    setSecondaryKeywords(secondary);
    setResearchFields(fields);
  }, []);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-navy-400 font-serif text-lg">项目未找到</p>
          <button className="btn-secondary mt-4 text-sm" onClick={() => navigate("/")}>返回工作台</button>
        </div>
      </div>
    );
  }

  const canGoBack = wizardStep > 1 && !isRunning;
  const canConfirm = wizardStepStatuses[wizardStep] === "review" && !isRunning;
  const confirmLabel = wizardStep === 4 ? "确认论文" : wizardStep === 5 ? "完成" : "确认并继续";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b border-navy-100 bg-ivory">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl font-semibold text-navy-700">{project.title}</h1>
            <p className="text-sm text-navy-400">{project.topic}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>
              <Globe size={14} />
              {language === "zh" ? "中文" : "EN"}
            </button>
            <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={() => navigate(`/export/${id}`)} disabled={generatedSections.length === 0}>
              <Download size={14} />
              导出
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <StepSidebar currentStep={wizardStep} stepStatuses={wizardStepStatuses} onStepClick={handleStepClick} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {wizardStep === 1 && (
            <StepKeywords
              projectId={id!} topic={project.topic} description={project.description}
              language={language} totalWordCount={totalWordCount} paperType={paperType}
              isRunning={isRunning} onRun={handleRunKeywords}
              keywords={projectKeywords} mainKeywords={mainKeywords}
              secondaryKeywords={secondaryKeywords} researchFields={researchFields}
              sectionConfig={sectionConfig}
              onKeywordsChange={handleKeywordsChange}
              onSectionConfigChange={setSectionConfig}
            />
          )}
          {wizardStep === 2 && (
            <StepSearch
              isRunning={isRunning} onRun={handleRunSearch}
              papers={papers} onTogglePaper={togglePaperSelection}
              onAddExternalPaper={handleAddExternalPaper}
            />
          )}
          {wizardStep === 3 && (
            <StepExtract
              isRunning={isRunning} onRun={handleRunExtract}
              viewpoints={viewpoints} selectedIndices={selectedViewpointIndices}
              onToggleSelect={toggleViewpointSelection}
              onSelectAll={selectAllViewpoints} onDeselectAll={deselectAllViewpoints}
              onEditViewpoint={handleEditViewpoint}
              onDeleteViewpoint={handleDeleteViewpoint}
              onAddViewpoint={handleAddViewpoint}
            />
          )}
          {wizardStep === 4 && (
            <StepWriting
              isRunning={isRunning} onRun={handleRunWrite}
              sections={generatedSections} references={references}
              integrityReport={integrityReport} aigcPatternCount={aigcPatternCount}
              onSectionChange={handleSectionChange} onReorder={handleReorder}
              uploadedImages={uploadedImages} onImageUpload={setUploadedImage}
              projectTitle={project.title} projectKeywords={projectKeywords}
            />
          )}
          {wizardStep === 5 && (
            <StepComplete
              projectId={id!} sections={generatedSections}
              references={references} totalWordCount={totalWordCount}
            />
          )}

          <div className="border-t border-navy-100 bg-ivory px-6 py-3 flex items-center justify-between">
            <button
              onClick={handleGoBack}
              disabled={!canGoBack}
              className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
              上一步
            </button>
            <span className="text-xs text-navy-400">
              步骤 {wizardStep}/5
            </span>
            {wizardStep < 5 && (
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirmLabel}
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {showRollbackDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm">
          <div className="bg-ivory rounded-2xl p-6 w-full max-w-sm shadow-xl border border-navy-100">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle size={20} className="text-amber-500" />
              <h3 className="font-serif text-lg font-semibold text-navy-700">确认回溯</h3>
            </div>
            <p className="text-sm text-navy-500 mb-5">
              回溯到步骤 {showRollbackDialog} 后，步骤 {showRollbackDialog + 1} 到 5 的结果将被清除，需要重新执行。是否继续？
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowRollbackDialog(null)} className="btn-secondary flex-1 text-sm">取消</button>
              <button onClick={handleRollbackConfirm} className="btn-primary flex-1 text-sm">确认回溯</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Task 19: 集成验证

- [ ] **Step 1: TypeScript 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: 前端构建**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 启动后端服务器**

Run: `npm run server:dev`
Expected: Server ready on port 3001

- [ ] **Step 4: 启动前端开发服务器**

Run: `npm run client:dev`
Expected: Vite ready on http://localhost:5173

- [ ] **Step 5: 手动测试完整流程**

1. 打开 http://localhost:5173/
2. 创建工作台
3. 在工作台中创建项目
4. 进入项目页面，确认显示 5 步向导
5. 点击"开始提取关键词"，确认 AI 返回关键词
6. 编辑关键词，确认可增删改
7. 点击"确认并继续"，进入文献检索步骤
8. 点击"开始检索文献"，确认返回文献列表
9. 选择/取消文献，点击"确认并继续"
10. 点击"开始提取观点"，确认返回观点列表
11. 选择/编辑观点，点击"确认并继续"
12. 点击"开始撰写论文"，确认生成完整论文
13. 编辑论文内容，点击"确认论文"
14. 在完成页面点击"导出论文"
15. 测试回溯：点击步骤导航中的"关键词提取"，确认弹出回溯确认对话框
16. 确认回溯后，后续步骤数据被清除

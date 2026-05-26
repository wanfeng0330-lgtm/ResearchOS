# 分步交互式论文撰写系统设计

## 1. 目标

将当前"一键全自动生成"模式改为 **5 步向导式交互流程**，每个步骤完成后暂停等待用户审核和编辑，确认后才继续下一步。

核心原则：**AI 处理 → 用户审核 → 确认继续** 的循环机制。

## 2. AI 模型分配

| 步骤 | 模型 | Tier | 具体模型 | 说明 |
|------|------|------|---------|------|
| 关键词提取 | DeepSeek | light | deepseek-chat (flash) | 简单提取任务 |
| 文献检索 | Search API | - | arXiv + Semantic Scholar + Crossref | 不使用 LLM |
| 文献解析 | DeepSeek | light | deepseek-chat (flash) | 轻量解析 |
| 观点提取 | Mimo | heavy | mimo-v2.5-pro | 需要深度理解文献 |
| 论文撰写 | Mimo | heavy | mimo-v2.5-pro | 长文本生成 |
| 引用格式化 | 规则 | - | citationAgent | 模板化操作 |
| 完整性审核 | 规则 | - | integrityAgent | 规则检查 |
| AIGC 降痕 | **提示词集成** | - | 注入 Mimo 写作输入 | 仅前端显示，不单独执行 |
| 图表生成 | DeepSeek | light | deepseek-chat (flash) | 结构化输出 |

### 关键变更

1. **light tier 模型改为 deepseek-chat**：当前 light tier 指向 Volcengine（无 API Key），需改为 DeepSeek 的 flash 模型
2. **AIGC 降痕不再单独执行**：将 `AIGC_REDUCTION_PROTOCOL` 提示词直接注入 Mimo 写作系统提示词中，前端仍显示"AIGC 降痕"步骤但仅展示检测结果
3. **orchestrator 中移除 aigcReductionAgent 的 execute 调用**，仅保留 detectAigcPatterns 用于前端展示

## 3. 5 步流程设计

### Step 1: 关键词提取

- **AI 任务**：`keywordAgent.execute()` + `sectionPlanner.execute()`（均使用 DeepSeek light tier）
- **展示内容**：
  - 核心关键词标签（蓝色）
  - 次要关键词标签（灰色）
  - 研究领域标签（绿色）
  - 章节规划预览（可折叠）
- **用户操作**：
  - 添加关键词（输入框 + 回车）
  - 删除关键词（点击标签 × 按钮）
  - 修改关键词（双击标签进入编辑）
  - 调整章节规划（启用/禁用、字数调整）
- **确认后数据**：`keywords: string[]` + `sectionConfig: SectionConfig[]`

### Step 2: 文献检索

- **AI 任务**：`searchAgent.execute()` + `parseAgent.execute()`（DeepSeek light tier）
- **展示内容**：
  - 文献卡片列表（标题、作者、年份、摘要、相关性评分、来源）
  - 已选/未选状态
- **用户操作**：
  - 勾选/取消文献
  - 添加外部文献（URL/DOI 输入框）
  - 导入本地文献（标题+作者+摘要手动输入）
- **确认后数据**：`papers: Paper[]`（含 selected 状态）

### Step 3: 观点提取

- **AI 任务**：`extractAgent.execute()`（Mimo heavy tier）
- **展示内容**：
  - 观点卡片列表（观点内容、来源文献标记 [n]）
  - 每个观点可展开查看关联文献
- **用户操作**：
  - 勾选/取消观点
  - 编辑观点内容（点击进入编辑模式）
  - 手动添加新观点
  - 删除观点
- **确认后数据**：`viewpoints: string[]`

### Step 4: 论文撰写

- **AI 任务**：`writingAgent.execute()` + `citationAgent.execute()` + `integrityAgent.execute()` + `chartAgent.execute()` + `formatAgent.execute()`（Mimo heavy tier）
- **展示内容**：
  - 完整论文预览（Markdown 渲染）
  - 图表占位符 `[图N: 描述]`
  - AIGC 检测结果（仅展示，不执行重写）
  - 完整性审核报告
- **用户操作**：
  - 在线编辑论文内容（contentEditable）
  - 上传图片替换占位符
  - 修改引用格式
- **确认后数据**：`sections: GeneratedSection[]` + `references: Reference[]`

### Step 5: 完成

- **展示内容**：最终论文全文 + 导出选项
- **用户操作**：导出（Word/PDF/LaTeX）、继续编辑、回溯修改

## 4. 前端架构

### 4.1 布局改造

将 `Project.tsx` 从三栏布局改为分步向导布局：

```
┌─────────────────────────────────────────────────┐
│  项目标题          [语言] [导出]                    │
├──────┬──────────────────────────────────────────┤
│      │                                          │
│ 步骤 │          当前步骤内容区                      │
│ 导航 │                                          │
│      │   ┌──────────────────────────────┐       │
│ ①关键词│   │   AI 结果展示 + 用户编辑区     │       │
│ ②文献  │   │                              │       │
│ ③观点  │   │                              │       │
│ ④撰写  │   │                              │       │
│ ⑤完成  │   └──────────────────────────────┘       │
│      │                                          │
│      │   [← 上一步]          [确认并继续 →]        │
├──────┴──────────────────────────────────────────┤
│  进度：步骤 2/5 - 文献检索中...  ████░░░░ 40%      │
└─────────────────────────────────────────────────┘
```

### 4.2 新增组件

| 组件 | 文件 | 功能 |
|------|------|------|
| `StepSidebar` | `src/components/StepSidebar.tsx` | 左侧步骤导航栏 |
| `StepKeywords` | `src/components/steps/StepKeywords.tsx` | Step 1: 关键词编辑 |
| `StepSearch` | `src/components/steps/StepSearch.tsx` | Step 2: 文献检索与选择 |
| `StepExtract` | `src/components/steps/StepExtract.tsx` | Step 3: 观点提取与筛选 |
| `StepWriting` | `src/components/steps/StepWriting.tsx` | Step 4: 论文撰写与编辑 |
| `StepComplete` | `src/components/steps/StepComplete.tsx` | Step 5: 完成与导出 |
| `KeywordTag` | `src/components/KeywordTag.tsx` | 可编辑关键词标签 |
| `ViewpointCard` | `src/components/ViewpointCard.tsx` | 观点卡片（可编辑/选择） |
| `ImageUploader` | `src/components/ImageUploader.tsx` | 图片上传替换占位符 |

### 4.3 状态管理

在 `useAppStore` 中新增：

```typescript
wizardStep: 1 | 2 | 3 | 4 | 5
setWizardStep: (step: number) => void
wizardStepStatus: Record<1|2|3|4|5, 'pending' | 'running' | 'review' | 'confirmed'>
setWizardStepStatus: (step: number, status: string) => void
viewpoints: string[]
setViewpoints: (viewpoints: string[]) => void
selectedViewpoints: boolean[]
toggleViewpoint: (index: number) => void
uploadedImages: Map<string, string>  // placeholderId → imageUrl
setUploadedImage: (placeholderId: string, imageUrl: string) => void
```

### 4.4 Project.tsx 重构

Project.tsx 变为向导容器，根据 `wizardStep` 渲染对应步骤组件：

```tsx
function Project() {
  const { wizardStep } = useAppStore()
  
  return (
    <div className="flex-1 flex flex-col h-full">
      <ProjectHeader />
      <div className="flex-1 flex overflow-hidden">
        <StepSidebar />
        <div className="flex-1 flex flex-col">
          {wizardStep === 1 && <StepKeywords />}
          {wizardStep === 2 && <StepSearch />}
          {wizardStep === 3 && <StepExtract />}
          {wizardStep === 4 && <StepWriting />}
          {wizardStep === 5 && <StepComplete />}
          <StepActions />  {/* 上一步 / 确认并继续 */}
        </div>
      </div>
    </div>
  )
}
```

## 5. 后端 API 改造

### 5.1 新增分步执行 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/generate/step/keywords` | POST | 执行关键词提取 + 章节规划 |
| `/api/generate/step/search` | POST | 执行文献检索 + 解析 |
| `/api/generate/step/extract` | POST | 执行观点提取 |
| `/api/generate/step/write` | POST | 执行论文撰写（含引用+审核+图表+排版） |
| `/api/generate/step/:step/confirm` | POST | 确认步骤结果，保存用户编辑数据 |
| `/api/generate/step/:step/rollback` | POST | 回溯到某步骤，清除后续数据 |

### 5.2 步骤数据存储

在 `projectService` 中新增：

```typescript
const stepDataMap = new Map<string, Record<string, unknown>>()

export function setStepData(projectId: string, step: string, data: unknown): void
export function getStepData(projectId: string, step: string): unknown | null
export function clearStepDataAfter(projectId: string, afterStep: number): void
```

### 5.3 分步执行路由设计

**POST /api/generate/step/keywords**
```typescript
// 请求
{ projectId, topic, description, language, totalWordCount, paperType }
// 响应
{ keywords: string[], sectionConfig: SectionConfig[] }
```

**POST /api/generate/step/search**
```typescript
// 请求
{ projectId, keywords: string[], topic }
// 响应
{ papers: Paper[] }
```

**POST /api/generate/step/extract**
```typescript
// 请求
{ projectId, paperIds: string[], topic }
// 响应
{ viewpoints: string[] }
```

**POST /api/generate/step/write**
```typescript
// 请求
{ projectId, viewpoints: string[], paperIds: string[], sectionConfig, citationFormat, language, totalWordCount, paperType, includeToc }
// 响应
{ sections: GeneratedSection[], references: Reference[], integrityReport, aigcReport }
```

**POST /api/generate/step/:step/confirm**
```typescript
// 请求
{ projectId, step: number, data: Record<string, unknown> }
// 响应
{ success: true }
```

**POST /api/generate/step/:step/rollback**
```typescript
// 请求
{ projectId, step: number }
// 响应
{ success: true, clearedSteps: number[] }
```

### 5.4 图片上传 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/upload/image` | POST | 上传图片（multipart/form-data） |
| `/api/uploads/:filename` | GET | 获取已上传图片 |

图片存储在 `uploads/` 目录，返回可访问的 URL。

## 6. 回溯机制

当用户回溯到步骤 N 修改数据时：

1. 弹出确认对话框："修改后，步骤 N+1 到步骤 5 的结果将被清除，需要重新执行。是否继续？"
2. 用户确认后：
   - 调用 `POST /api/generate/step/:step/rollback`
   - 后端清除 `stepDataMap` 中步骤 N+1 到 5 的数据
   - 清除后续步骤的 sections、references、viewpoints 等
3. 前端更新状态：
   - `wizardStep` 设为 N
   - 步骤 N 状态设为 `review`
   - 步骤 N+1 到 5 状态设为 `pending`

## 7. 图片上传机制

1. 论文撰写阶段，AI 在需要插图的位置插入占位符：`[图N: 描述文字]`
2. 用户在编辑模式下，点击占位符触发 `ImageUploader` 组件
3. 上传图片到 `/api/upload/image`，返回 URL
4. 占位符替换为 `<img src="...">` 标签
5. 导出时，占位符替换为实际图片

## 8. 内容质量控制

### 8.1 Prompt 优化

在 `researchSkillGuidance.ts` 中增强写作提示词：

**反空段落规则**（新增到 WRITING_QUALITY_PROTOCOL）：
```
- NEVER produce a section that contains only a heading and 1-2 generic sentences. Every section must have substantive, developed content with multiple paragraphs of analysis.
- NEVER pad content with filler to meet word counts. If a section naturally requires fewer words, write fewer words rather than inflating with repetition.
- Dynamically allocate word counts based on content complexity: give more space to sections with richer evidence and analysis, less to sections that are naturally concise.
```

**AIGC 降痕集成到写作提示词**：
将 `AIGC_REDUCTION_PROTOCOL` 的全部内容注入 Mimo 的写作系统提示词中，确保写作阶段直接产出低 AIGC 痕迹的内容。

### 8.2 动态字数分配

修改 `writingAgent.ts`：
- 移除固定字数硬编码
- 改为"总字数目标 + 最小段落字数阈值（100字）"
- 提示词中明确："总字数目标为 N 字，各章节根据内容重要性动态分配，但每个章节不少于 100 字"

## 9. LLM Tier 配置变更

修改 `llmService.ts` 中的 tier 配置：

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

将 light tier 从 Volcengine 改为 DeepSeek flash 模型（deepseek-chat），复用现有 DEEPSEEK_API_KEY。

## 10. 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/components/StepSidebar.tsx` | 步骤导航栏 |
| `src/components/steps/StepKeywords.tsx` | 关键词编辑步骤 |
| `src/components/steps/StepSearch.tsx` | 文献检索步骤 |
| `src/components/steps/StepExtract.tsx` | 观点提取步骤 |
| `src/components/steps/StepWriting.tsx` | 论文撰写步骤 |
| `src/components/steps/StepComplete.tsx` | 完成步骤 |
| `src/components/KeywordTag.tsx` | 可编辑关键词标签 |
| `src/components/ViewpointCard.tsx` | 观点卡片 |
| `src/components/ImageUploader.tsx` | 图片上传组件 |
| `api/routes/generateSteps.ts` | 分步执行 API 路由 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/pages/Project.tsx` | 重构为向导容器 |
| `src/store/useAppStore.ts` | 新增 wizard 相关状态 |
| `src/utils/api.ts` | 新增分步 API 调用函数 |
| `shared/types.ts` | 新增 WizardStep 类型 |
| `api/services/llmService.ts` | light tier 改为 DeepSeek flash |
| `api/services/projectService.ts` | 新增 stepDataMap |
| `api/agents/orchestrator.ts` | 新增分步执行函数 |
| `api/agents/writingAgent.ts` | AIGC 提示词集成 + 动态字数 |
| `api/agents/researchSkillGuidance.ts` | 增强反空段落规则 |
| `api/app.ts` | 注册新路由 + 静态文件服务 |
| `api/server.ts` | 创建 uploads 目录 |

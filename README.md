# ResearchOS

AI 驱动的科研工作流平台 — 从文献检索到论文撰写的全流程智能辅助系统。

## ✨ 核心特性

- **6 步向导式交互流程**：关键词提取 → 文献检索 → 观点提取 → 大纲生成 → 论文撰写 → 完成
- **每步用户可控**：AI 处理后暂停等待用户审核编辑，确认后才继续下一步
- **AI 智能文献筛选**：检索 45 篇 → AI 四维评分（关键词重叠/主题契合/方法兼容/贡献潜力）→ 精选 Top 25
- **内容驱动大纲生成**：基于提取的观点智能生成论文结构，而非固定模板
- **三层 LLM 架构**：DeepSeek Flash（轻量任务）+ Mimo-V2.5-Pro（重推理/写作）
- **AIGC 降痕**：6 大人性化改写技术以提示词形式集成到写作流程，前端展示检测结果
- **回溯机制**：随时回到之前的步骤修改，后续步骤自动清除重做
- **图片上传**：论文中预留占位符，支持上传替换自定义图片
- **多格式导出**：Word / PDF / LaTeX

## 🏗️ 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS + Framer Motion + Zustand |
| 后端 | Express.js + TypeScript |
| LLM | DeepSeek Flash (light) + Mimo V2.5 Pro (heavy) |
| 文献检索 | arXiv + Semantic Scholar + Crossref |
| 数据库 | PostgreSQL + Drizzle ORM（可选，未配置时自动降级到内存存储） |
| 缓存 | Redis（可选）+ 双层 LLM 缓存（L1 内存 + L2 文件） |

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/wanfeng0330-lgtm/ResearchOS.git
cd ResearchOS
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Key：

| 变量 | 必需 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key，用于关键词提取、文献分析、大纲生成 |
| `TOKEN_PLAN_API_KEY` | ✅ | Token Plan / Mimo API Key，用于观点提取和论文撰写 |
| `SILICONFLOW_API_KEY` | ❌ | SiliconFlow API Key，用于图表图片生成 |
| `IMAGE_API_KEY` | ❌ | 图片生成 API Key |
| `DATABASE_URL` | ❌ | PostgreSQL 连接字符串，未配置时使用内存存储 |
| `REDIS_URL` | ❌ | Redis 连接字符串 |

### 3. 启动开发服务器

```bash
# 启动后端（端口 3001）
npm run server:dev

# 启动前端（端口 5173）
npm run client:dev
```

### 4. 构建生产版本

```bash
npm run build
```

## ☁️ Railway 部署

1. 在 Railway 中创建新项目，连接 GitHub 仓库
2. 在 **Settings → Variables** 中添加环境变量（不要提交 `.env` 到 Git）：
   - `DEEPSEEK_API_KEY` = `你的 DeepSeek Key`
   - `TOKEN_PLAN_API_KEY` = `你的 Mimo Key`
   - 其他可选变量按需添加
3. Railway 会自动检测并构建项目
4. 设置启动命令：`node dist/server.js`

## 📁 项目结构

```
ResearchOS/
├── api/                    # 后端
│   ├── agents/             # AI Agent 模块
│   │   ├── keywordAgent.ts       # 关键词提取
│   │   ├── searchAgent.ts        # 文献检索（45篇→AI评分→Top25）
│   │   ├── extractAgent.ts       # 观点提取
│   │   ├── outlineAgent.ts       # AI 大纲生成
│   │   ├── writingAgent.ts       # 论文撰写
│   │   ├── citationAgent.ts      # 引用格式化
│   │   ├── integrityAgent.ts     # 完整性审核
│   │   ├── chartAgent.ts         # 图表生成
│   │   ├── formatAgent.ts        # 排版组装
│   │   └── researchSkillGuidance.ts  # 学术写作协议 + AIGC 降痕
│   ├── services/           # 业务服务
│   │   ├── llmService.ts         # 三层 LLM 调用
│   │   ├── llmCache.ts           # 双层缓存
│   │   ├── searchService.ts      # 学术搜索
│   │   ├── relevanceScorer.ts    # AI 语义相关性评分
│   │   ├── projectService.ts     # 项目管理
│   │   └── ...
│   ├── routes/             # API 路由
│   │   ├── generateSteps.ts      # 分步执行 API（6步）
│   │   └── ...
│   ├── db/                 # 数据库（可选）
│   └── app.ts / server.ts
├── src/                    # 前端
│   ├── pages/              # 页面组件
│   ├── components/         # UI 组件
│   │   ├── steps/                # 6 步向导组件
│   │   ├── StepSidebar.tsx       # 步骤导航
│   │   ├── PaperCard.tsx         # 文献卡片（含AI评分）
│   │   └── ...
│   ├── store/              # Zustand 状态管理
│   └── utils/              # API 调用函数
├── shared/                 # 前后端共享类型
│   └── types.ts
└── .env.example            # 环境变量模板
```

## 🔐 安全说明

- `.env` 文件已被 `.gitignore` 排除，**永远不会被提交到 Git**
- 部署时通过平台环境变量（如 Railway Variables）注入 API Key
- `.env.example` 仅包含变量名和占位符，可安全提交

## 📜 License

MIT

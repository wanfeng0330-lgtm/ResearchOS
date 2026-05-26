import { v4 as uuidv4 } from 'uuid'
import { callLightLLM } from '../services/llmService.js'
import type { GeneratedSection, Paper, ChartDefinition } from '../../shared/types.js'

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || ''

interface QuickChartConfig {
  type: string
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor?: string | string[]
      borderColor?: string | string[]
      fill?: boolean
    }>
  }
  options?: Record<string, unknown>
}

interface ContentChartSpec {
  title: string
  caption: string
  chartType: 'bar' | 'line' | 'pie'
  sectionType: string
  labels: string[]
  datasets: Array<{ label: string; data: number[] }>
}

export async function execute(
  sections: GeneratedSection[],
  papers: Paper[],
  topic: string
): Promise<ChartDefinition[]> {
  if (sections.length === 0) return []

  const charts: ChartDefinition[] = []

  const contentCharts = await buildContentDrivenCharts(sections, topic)
  for (const chart of contentCharts) {
    if (chart) charts.push(chart)
  }

  if (papers.length > 0) {
    const metaCharts = await buildMetadataCharts(papers, sections, topic)
    for (const chart of metaCharts) {
      if (chart) charts.push(chart)
    }
  }

  return charts
}

async function buildContentDrivenCharts(
  sections: GeneratedSection[],
  topic: string
): Promise<(ChartDefinition | null)[]> {
  const bodySections = sections.filter(
    (s) => !['abstract', 'introduction', 'conclusion', 'limitations'].includes(s.type)
      && s.content.length > 200
  )

  if (bodySections.length === 0) return []

  const sectionSummaries = bodySections.map((s) => ({
    type: s.type,
    title: s.title,
    contentPreview: s.content.slice(0, 1500),
  }))

  const systemPrompt = `你是一位学术数据可视化专家。你的任务是从论文内容中提取可以可视化的数据，设计学术图表。

规则：
1. 只提取论文中明确提到的数据、比较、趋势、分类等信息
2. 不要编造论文中不存在的数据
3. 每个图表必须有明确的学术意义
4. 图表类型选择：比较类用bar，趋势类用line，占比类用pie
5. 标签和数据必须来自论文内容
6. 输出严格的JSON格式`

  const prompt = `论文主题：${topic}

以下是论文各章节的内容摘要：
${sectionSummaries.map((s) => `【${s.title}】\n${s.contentPreview}`).join('\n\n')}

请从以上论文内容中提取2-3个可以可视化的图表方案。每个图表必须紧密反映论文的核心论点、研究发现或关键概念。

返回JSON数组，每个元素包含：
- title: 图表标题（中文，简洁学术风格）
- caption: 图表说明（中文，"图N. xxx"格式，包含数据来源说明）
- chartType: "bar" | "line" | "pie"
- sectionType: 该图表应放置的章节类型（如related_work, methodology, findings, discussion）
- labels: X轴标签数组（中文，3-8个）
- datasets: 数据集数组，每个包含label（中文）和data（数值数组）

示例格式：
[{"title":"各方法性能对比","caption":"图1. 不同方法在主要评估指标上的性能对比（数据来源：文献[3][5][7]）","chartType":"bar","sectionType":"findings","labels":["方法A","方法B","方法C","方法D"],"datasets":[{"label":"准确率(%)","data":[85,92,88,95]}]}]

只返回JSON数组，不要其他文字。如果论文内容中没有可提取的量化数据，返回空数组[]。`

  try {
    const response = await callLightLLM(prompt, systemPrompt, { maxTokens: 2048, temperature: 0.3 })
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const specs: ContentChartSpec[] = JSON.parse(cleaned)

    if (!Array.isArray(specs) || specs.length === 0) return []

    return await Promise.all(
      specs.slice(0, 3).map((spec, idx) =>
        buildChartFromSpec(spec, sections, idx + 1)
      )
    )
  } catch (error) {
    console.warn('[ChartAgent] Failed to extract content-driven charts:', error instanceof Error ? error.message : error)
    return []
  }
}

async function buildChartFromSpec(
  spec: ContentChartSpec,
  sections: GeneratedSection[],
  figureNumber: number
): Promise<ChartDefinition | null> {
  try {
    if (!spec.labels || spec.labels.length < 2 || !spec.datasets || spec.datasets.length === 0) {
      return null
    }

    const chartType = spec.chartType === 'pie' ? 'pie' : spec.chartType === 'line' ? 'line' : 'bar'

    const config: QuickChartConfig = {
      type: chartType === 'pie' ? 'pie' : chartType,
      data: {
        labels: spec.labels,
        datasets: spec.datasets.map((ds, i) => ({
          label: ds.label,
          data: ds.data,
          backgroundColor: chartType === 'pie'
            ? ['#1d4ed8', '#0f766e', '#d97706', '#7c3aed', '#dc2626', '#059669', '#7c2d12', '#4338ca']
            : i === 0
              ? '#1d4ed8'
              : i === 1
                ? '#0f766e'
                : '#d97706',
          borderColor: chartType === 'line'
            ? i === 0 ? '#1d4ed8' : i === 1 ? '#0f766e' : '#d97706'
            : undefined,
          fill: chartType === 'line' ? i === 0 : undefined,
        })),
      },
      options: chartType === 'pie'
        ? { plugins: { legend: { display: true, position: 'right' } } }
        : baseChartOptions(spec.labels.length > 4 ? '' : '', ''),
    }

    const position = findBestSectionPosition(sections, [spec.sectionType])

    return createChartDefinition(
      chartType as ChartDefinition['type'],
      spec.title,
      spec.caption || `图${figureNumber}. ${spec.title}`,
      config,
      position
    )
  } catch (error) {
    console.warn('[ChartAgent] Failed to build chart from spec:', error instanceof Error ? error.message : error)
    return null
  }
}

async function buildMetadataCharts(
  papers: Paper[],
  sections: GeneratedSection[],
  topic: string
): Promise<(ChartDefinition | null)[]> {
  return Promise.all([
    buildYearDistributionChart(papers, sections),
    buildKeywordChart(papers, sections),
  ])
}

async function buildYearDistributionChart(papers: Paper[], sections: GeneratedSection[]): Promise<ChartDefinition | null> {
  const yearCounts = new Map<number, number>()
  for (const paper of papers) {
    yearCounts.set(paper.year, (yearCounts.get(paper.year) || 0) + 1)
  }

  const labels = Array.from(yearCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-8)
    .map(([year]) => String(year))
  const data = labels.map((label) => yearCounts.get(Number(label)) || 0)
  if (labels.length < 2) return null

  const config: QuickChartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '发表数量',
          data,
          borderColor: '#0f766e',
          backgroundColor: 'rgba(15,118,110,0.18)',
          fill: true,
        },
      ],
    },
    options: baseChartOptions('年份', '数量'),
  }

  return createChartDefinition(
    'line',
    '文献发表趋势',
    '文献检索范围内按年份的发表趋势分布。',
    config,
    findBestSectionPosition(sections, ['related_work', 'literature_review', 'introduction'])
  )
}

async function buildKeywordChart(papers: Paper[], sections: GeneratedSection[]): Promise<ChartDefinition | null> {
  const keywordCounts = new Map<string, number>()
  for (const paper of papers) {
    if (paper.keywords && Array.isArray(paper.keywords)) {
      for (const kw of paper.keywords) {
        const normalized = kw.trim().toLowerCase()
        if (normalized) {
          keywordCounts.set(normalized, (keywordCounts.get(normalized) || 0) + 1)
        }
      }
    }
  }

  const sorted = Array.from(keywordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  if (sorted.length < 2) return null

  const labels = sorted.map(([kw]) => kw)
  const data = sorted.map(([, count]) => count)

  const config: QuickChartConfig = {
    type: 'horizontalBar',
    data: {
      labels,
      datasets: [
        {
          label: '出现频率',
          data,
          backgroundColor: '#7c3aed',
        },
      ],
    },
    options: baseChartOptions('频率', '关键词'),
  }

  return createChartDefinition(
    'bar',
    '高频关键词',
    '筛选文献中出现频率最高的关键词分布。',
    config,
    findBestSectionPosition(sections, ['methodology', 'related_work'])
  )
}

async function generateImageWithQwen(
  chartTitle: string,
  chartCaption: string,
  chartType: string,
  chartConfig: QuickChartConfig
): Promise<string | null> {
  try {
    const labelsStr = chartConfig.data.labels.join(', ')
    const datasetsStr = chartConfig.data.datasets
      .map((ds) => `${ds.label}: [${ds.data.join(', ')}]`)
      .join('; ')

    const prompt = `专业学术${chartType}图表可视化："${chartTitle}"。${chartCaption}。X轴标签：${labelsStr}。数据系列 - ${datasetsStr}。干净、现代、高质量的科学图表风格，清晰的中文标签，网格线，白色背景。出版级学术图表。`

    const response = await fetch('https://api.siliconflow.cn/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SILICONFLOW_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen-Image',
        prompt,
        image_size: '1024x576',
        num_inference_steps: 20,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`SiliconFlow API error: ${response.status} ${response.statusText} - ${errorText}`)
      return null
    }

    const result = await response.json()

    if (result.images && result.images.length > 0 && result.images[0].url) {
      return result.images[0].url
    }

    if (result.data && result.data.length > 0 && result.data[0].url) {
      return result.data[0].url
    }

    console.error('SiliconFlow API unexpected response format:', JSON.stringify(result).substring(0, 500))
    return null
  } catch (error) {
    console.error('Failed to generate image with Qwen-Image:', error)
    return null
  }
}

async function createChartDefinition(
  type: ChartDefinition['type'],
  title: string,
  caption: string,
  chartConfig: QuickChartConfig,
  position: number
): Promise<ChartDefinition> {
  const qwenImageUrl = await generateImageWithQwen(title, caption, type, chartConfig)
  const imageUrl = qwenImageUrl || buildQuickChartUrl(chartConfig)

  return {
    id: uuidv4(),
    type,
    title,
    caption,
    position,
    data: {
      chartConfig,
      imageUrl,
    },
  }
}

function buildQuickChartUrl(config: QuickChartConfig): string {
  const encoded = encodeURIComponent(JSON.stringify(config))
  return `https://quickchart.io/chart?width=900&height=500&format=png&backgroundColor=white&c=${encoded}`
}

function baseChartOptions(xTitle: string, yTitle: string): Record<string, unknown> {
  return {
    plugins: {
      legend: { display: true, position: 'top' },
      title: { display: false },
    },
    scales: {
      xAxes: [{ scaleLabel: { display: true, labelString: xTitle } }],
      yAxes: [{ scaleLabel: { display: true, labelString: yTitle }, ticks: { beginAtZero: true } }],
    },
  }
}

function findBestSectionPosition(sections: GeneratedSection[], preferredTypes: string[]): number {
  for (const type of preferredTypes) {
    const section = sections.find((item) => item.type === type)
    if (section) return section.order
  }
  return sections[0]?.order ?? 0
}

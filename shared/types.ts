export interface Project {
  id: string;
  workspaceId?: string;
  title: string;
  topic: string;
  description: string;
  status: "draft" | "searching" | "parsing" | "generating" | "completed";
  createdAt: string;
  updatedAt: string;
  sectionConfig?: SectionConfig[];
  totalWordCount?: number;
  keywords?: string[];
  language: "en" | "zh";
}

export interface SectionConfig {
  type: string;
  title: string;
  enabled: boolean;
  wordCount: number;
  order: number;
}

export const DEFAULT_SECTIONS: SectionConfig[] = [
  { type: "abstract", title: "摘要", enabled: true, wordCount: 400, order: 0 },
  { type: "introduction", title: "引言", enabled: true, wordCount: 800, order: 1 },
  { type: "related_work", title: "文献综述", enabled: true, wordCount: 1500, order: 2 },
  { type: "methodology", title: "研究方法", enabled: true, wordCount: 1200, order: 3 },
  { type: "findings", title: "研究发现", enabled: true, wordCount: 1000, order: 4 },
  { type: "discussion", title: "讨论", enabled: true, wordCount: 800, order: 5 },
  { type: "limitations", title: "局限性", enabled: true, wordCount: 500, order: 6 },
  { type: "conclusion", title: "结论", enabled: true, wordCount: 600, order: 7 },
];

export interface Paper {
  id: string;
  projectId: string;
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  source: "arxiv" | "semantic_scholar" | "crossref";
  sourceId: string;
  pdfUrl?: string;
  citationCount?: number;
  keywords?: string[];
  bibtex?: string;
  doi?: string;
  selected: boolean;
  relevanceScore?: number;
  journal?: string;
  aiScores?: {
    keywordOverlap: number;
    thematicAlignment: number;
    methodologyCompatibility: number;
    contributionPotential: number;
    reason: string;
  };
}

export interface GeneratedSection {
  id: string;
  projectId: string;
  type: string;
  title: string;
  content: string;
  citations: Citation[];
  order: number;
  wordCount?: number;
  charts?: ChartDefinition[];
}

export interface ChartDefinition {
  id: string;
  type: "bar" | "line" | "pie" | "scatter" | "heatmap" | "flowchart" | "network";
  title: string;
  caption: string;
  data: Record<string, unknown>;
  position: number;
}

export interface Citation {
  id: string;
  paperId: string;
  sectionId: string;
  format: "bibtex" | "gbt" | "apa" | "ieee";
  text: string;
  position: number;
}

export interface ExportJob {
  id: string;
  projectId: string;
  format: "docx" | "pdf" | "latex" | "typst";
  citationFormat: "bibtex" | "gbt" | "apa" | "ieee";
  downloadUrl?: string;
  fileName?: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
}

export interface Reference {
  id: string;
  paperId: string;
  authors: string;
  title: string;
  year: number;
  journal?: string;
  doi?: string;
  bibtex: string;
  apa: string;
  ieee: string;
  gbt: string;
}

export type AgentStage = "keyword_extracting" | "searching" | "parsing" | "extracting" | "writing" | "citing" | "integrity_reviewing" | "aigc_detecting" | "charting" | "formatting";

export interface GenerationProgress {
  stage: AgentStage;
  progress: number;
  message: string;
  partialContent?: string;
}

export type CitationFormat = "bibtex" | "gbt" | "apa" | "ieee";
export type ExportFormat = "docx" | "pdf" | "latex" | "typst";
export type PaperType = "graduation" | "journal" | "literature_review" | "term_paper" | "proposal";

export const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  graduation: "毕业论文",
  journal: "期刊论文",
  literature_review: "文献综述",
  term_paper: "期末论文",
  proposal: "开题报告",
};

export const PAPER_TYPE_DESCRIPTIONS: Record<PaperType, string> = {
  graduation: "完整的学位论文，包含摘要、引言、文献综述、研究方法、实验结果、讨论和结论",
  journal: "面向学术期刊投稿的论文，强调创新性、实验验证和学术贡献",
  literature_review: "系统性文献综述，侧重对现有研究的梳理、比较和批判性分析",
  term_paper: "课程期末论文，结构相对简洁，侧重对特定主题的深入分析",
  proposal: "研究开题报告，侧重研究背景、问题提出、研究方案和可行性论证",
};

export interface GenerationRequest {
  projectId: string;
  topic: string;
  description: string;
  citationFormat: CitationFormat;
  sectionConfig: SectionConfig[];
  totalWordCount: number;
  autoSelectPapers: boolean;
  language?: "en" | "zh";
  includeToc?: boolean;
  paperType?: PaperType;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  defaultCitationFormat: CitationFormat;
  defaultLanguage: "en" | "zh";
  defaultPaperType: PaperType;
}

export interface KnowledgeEntry {
  id: string;
  projectId: string;
  type: "viewpoint" | "summary" | "note";
  content: string;
  sourcePaperIds: string[];
  sectionType?: string;
  createdAt: string;
}

export interface CitationChainLink {
  id: string;
  projectId: string;
  paperId: string;
  sectionId: string;
  context: string;
  createdAt: string;
}

export interface WorkflowStageResult {
  stage: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowState {
  projectId: string;
  currentStage: string;
  completedStages: string[];
  failedStage: string | null;
  stageHistory: WorkflowStageResult[];
  canResume: boolean;
  startedAt: string;
  updatedAt: string;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

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

export interface OutlineSection extends SectionConfig {
  keyPoints: string[]
  sourceHints: string[]
}

export interface StepOutlineData {
  sections: OutlineSection[]
  totalWordCount: number
  rationale: string
}

export interface StepWriteData {
  sections: GeneratedSection[]
  references: Reference[]
  integrityReport: { issues: Array<{ severity: string; category: string; message: string }>; summary: string; passed: boolean }
  aigcPatternCount: number
}

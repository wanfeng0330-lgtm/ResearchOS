import type {
  CitationChainLink, CitationFormat, ExportFormat, GeneratedSection,
  GenerationProgress, KnowledgeEntry, Paper, PaperType, Project, Reference,
  SectionConfig, WorkflowState, Workspace, StepKeywordsData, StepSearchData,
  StepExtractData, StepOutlineData, StepWriteData, User,
} from "../../shared/types";

const API_BASE = "/api";

// Token management
function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setToken(token: string) {
  localStorage.setItem('auth_token', token);
}

export function clearToken() {
  localStorage.removeItem('auth_token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  const json = await res.json();
  return json.data as T;
}

interface ProjectPayload extends Project {
  papers?: Paper[];
  sections?: GeneratedSection[];
  references?: Reference[];
  keywords?: string[];
}

interface ExportResponse {
  jobId: string;
  format: ExportFormat;
  citationFormat: CitationFormat;
  fileName?: string;
  downloadUrl: string;
  status: string;
}

export async function fetchProjects() {
  return request<Project[]>("/projects");
}

export async function createProject(topic: string, title?: string, description?: string, language?: "en" | "zh") {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({ topic, title, description, language }),
  });
}

export async function fetchProject(id: string) {
  return request<ProjectPayload>(`/projects/${id}`);
}

export async function searchPapers(query: string, sources?: string[]) {
  return request<Paper[]>("/search", {
    method: "POST",
    body: JSON.stringify({ query, sources, maxResults: 40 }),
  });
}

export async function selectPapers(projectId: string, paperIds: string[]) {
  return request<Paper[]>("/search/select", {
    method: "POST",
    body: JSON.stringify({ projectId, paperIds }),
  });
}

export async function generateRelatedWork(
  projectId: string,
  citationFormat: CitationFormat,
  sectionConfig: SectionConfig[],
  totalWordCount: number,
  autoSelectPapers: boolean,
  description?: string,
  language?: "en" | "zh",
  includeToc?: boolean,
  paperType?: PaperType
) {
  return request<{ message: string; projectId: string }>("/generate/related-work", {
    method: "POST",
    body: JSON.stringify({ projectId, citationFormat, sectionConfig, totalWordCount, autoSelectPapers, description, language, includeToc, paperType }),
  });
}

export async function planSections(topic: string, description: string, totalWordCount: number, language: "en" | "zh") {
  return request<SectionConfig[]>("/generate/plan-sections", {
    method: "POST",
    body: JSON.stringify({ topic, description, totalWordCount, language }),
  });
}

export async function getGenerationProgress(projectId: string) {
  return request<GenerationProgress & { status: string; papers?: Paper[] }>(`/generate/progress/${projectId}`);
}

export async function exportDocument(
  projectId: string,
  format: ExportFormat,
  citationFormat: CitationFormat,
  includeCharts: boolean,
  includeToc?: boolean
) {
  return request<ExportResponse>("/export", {
    method: "POST",
    body: JSON.stringify({ projectId, format, citationFormat, includeCharts, includeToc }),
  });
}

export async function downloadFile(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/export/${jobId}/download`);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  let filename = "document";
  if (disposition) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      filename = match[1].replace(/['"]/g, "");
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function fetchWorkspaces() {
  return request<Workspace[]>("/workspaces");
}

export async function createWorkspace(name: string, description?: string) {
  return request<Workspace>("/workspaces", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function fetchWorkspace(id: string) {
  return request<Workspace>(`/workspaces/${id}`);
}

export async function fetchWorkspaceProjects(workspaceId: string) {
  return request<Project[]>(`/workspaces/${workspaceId}/projects`);
}

export async function createProjectInWorkspace(workspaceId: string, topic: string, title?: string, description?: string, language?: "en" | "zh") {
  return request<Project>(`/workspaces/${workspaceId}/projects`, {
    method: "POST",
    body: JSON.stringify({ topic, title, description, language }),
  });
}

export async function fetchKnowledgeBase(projectId: string) {
  return request<KnowledgeEntry[]>(`/projects/${projectId}/knowledge-base`);
}

export async function fetchCitationChain(projectId: string) {
  return request<CitationChainLink[]>(`/projects/${projectId}/citation-chain`);
}

export async function fetchWorkflowState(projectId: string) {
  return request<WorkflowState | null>(`/projects/${projectId}/workflow`);
}

export async function resumeWorkflow(projectId: string) {
  return request<WorkflowState>(`/projects/${projectId}/workflow/resume`, {
    method: "POST",
  });
}

export async function cancelWorkflow(projectId: string) {
  return request<WorkflowState>(`/projects/${projectId}/workflow/cancel`, {
    method: "POST",
  });
}

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

export async function stepOutline(params: {
  projectId: string; viewpoints?: string[]; topic?: string;
  totalWordCount?: number; language?: 'en' | 'zh';
  paperType?: PaperType; paperCount?: number;
}) {
  return request<StepOutlineData>('/generate/step/outline', {
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

// Auth API
export async function register(email: string, password: string, name?: string) {
  return request<{ id: string; email: string; name: string; role: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export async function login(email: string, password: string) {
  const result = await request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(result.token);
  return result;
}

export async function logout() {
  await request<{ message: string }>('/auth/logout', { method: 'POST' });
  clearToken();
}

export async function getCurrentUser() {
  return request<User>('/auth/me');
}

// Health check
export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

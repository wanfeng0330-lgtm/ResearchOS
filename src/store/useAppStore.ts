import { create } from "zustand";
import type {
  Project, Paper, GeneratedSection, GenerationProgress, CitationFormat,
  SectionConfig, Reference, PaperType, Workspace, WizardStep, WizardStepStatus,
} from "../../shared/types";
import { DEFAULT_SECTIONS } from "../../shared/types";

interface AppState {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  papers: Paper[];
  setPapers: (papers: Paper[]) => void;
  togglePaperSelection: (paperId: string) => void;

  generatedSections: GeneratedSection[];
  setGeneratedSections: (sections: GeneratedSection[]) => void;

  generationProgress: GenerationProgress | null;
  setGenerationProgress: (progress: GenerationProgress | null) => void;

  citationFormat: CitationFormat;
  setCitationFormat: (format: CitationFormat) => void;

  sectionConfig: SectionConfig[];
  setSectionConfig: (config: SectionConfig[]) => void;
  updateSectionConfig: (type: string, updates: Partial<SectionConfig>) => void;

  references: Reference[];
  setReferences: (refs: Reference[]) => void;

  totalWordCount: number;
  setTotalWordCount: (count: number) => void;

  autoSelectPapers: boolean;
  setAutoSelectPapers: (auto: boolean) => void;

  language: "en" | "zh";
  setLanguage: (lang: "en" | "zh") => void;

  paperType: PaperType;
  setPaperType: (type: PaperType) => void;

  sidebarOpen: boolean;
  toggleSidebar: () => void;

  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;
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
  keywords: string[];
  setKeywords: (keywords: string[]) => void;
  uploadedImages: Record<string, string>;
  setUploadedImage: (placeholderId: string, imageUrl: string) => void;
}

const useAppStore = create<AppState>((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  deleteProject: (id) =>
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),

  papers: [],
  setPapers: (papers) => set({ papers }),
  togglePaperSelection: (paperId) =>
    set((state) => ({
      papers: state.papers.map((p) =>
        p.id === paperId ? { ...p, selected: !p.selected } : p
      ),
    })),

  generatedSections: [],
  setGeneratedSections: (sections) => set({ generatedSections: sections }),

  generationProgress: null,
  setGenerationProgress: (progress) => set({ generationProgress: progress }),

  citationFormat: "gbt",
  setCitationFormat: (format) => set({ citationFormat: format }),

  sectionConfig: DEFAULT_SECTIONS,
  setSectionConfig: (config) => set({ sectionConfig: config }),
  updateSectionConfig: (type, updates) =>
    set((state) => ({
      sectionConfig: state.sectionConfig.map((s) =>
        s.type === type ? { ...s, ...updates } : s
      ),
    })),

  references: [],
  setReferences: (refs) => set({ references: refs }),

  totalWordCount: 5000,
  setTotalWordCount: (count) => set({ totalWordCount: count }),

  autoSelectPapers: true,
  setAutoSelectPapers: (auto) => set({ autoSelectPapers: auto }),

  language: "zh",
  setLanguage: (lang) => set({ language: lang }),

  paperType: "graduation",
  setPaperType: (type) => set({ paperType: type }),

  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  workspaces: [],
  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (workspace) =>
    set((state) => ({ workspaces: [...state.workspaces, workspace] })),
  currentWorkspaceId: null,
  setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
  wizardStep: 1,
  setWizardStep: (step) => set({ wizardStep: step }),
  wizardStepStatuses: { 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending', 5: 'pending', 6: 'pending' },
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
  keywords: [],
  setKeywords: (keywords) => set({ keywords }),
  uploadedImages: {},
  setUploadedImage: (placeholderId, imageUrl) =>
    set((state) => ({
      uploadedImages: { ...state.uploadedImages, [placeholderId]: imageUrl },
    })),
}));

export default useAppStore;

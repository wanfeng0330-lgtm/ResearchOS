import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Globe, Download, ChevronLeft, ChevronRight, AlertCircle, X } from "lucide-react";
import useAppStore from "@/store/useAppStore";
import StepSidebar from "@/components/StepSidebar";
import StepKeywords from "@/components/steps/StepKeywords";
import StepSearch from "@/components/steps/StepSearch";
import StepExtract from "@/components/steps/StepExtract";
import StepOutline from "@/components/steps/StepOutline";
import StepWriting from "@/components/steps/StepWriting";
import StepComplete from "@/components/steps/StepComplete";
import {
  fetchProject, stepKeywords, stepSearch, stepExtract, stepOutline, stepWrite,
  stepConfirm, stepRollback,
} from "@/utils/api";
import type { WizardStep, SectionConfig, Paper, OutlineSection } from "../../shared/types";

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
    keywords: projectKeywords, setKeywords,
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
  const [error, setError] = useState<string | null>(null);
  const [mainKeywords, setMainKeywords] = useState<string[]>([]);
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([]);
  const [researchFields, setResearchFields] = useState<string[]>([]);
  const [outlineSections, setOutlineSections] = useState<OutlineSection[]>([]);
  const [outlineRationale, setOutlineRationale] = useState("");
  const [integrityReport, setIntegrityReport] = useState<{ issues: Array<{ severity: string; category: string; message: string }>; summary: string; passed: boolean } | null>(null);
  const [aigcPatternCount, setAigcPatternCount] = useState<number | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState<WizardStep | null>(null);

  const handleRunKeywords = useCallback(async () => {
    if (!id || !project) return;
    setIsRunning(true);
    setError(null);
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
      setKeywords(result.keywords);
      setWizardStepStatus(1, "review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "关键词提取失败，请重试";
      console.error("Keywords step failed:", err);
      setError(msg);
      setWizardStepStatus(1, "pending");
    } finally {
      setIsRunning(false);
    }
  }, [id, project, language, totalWordCount, paperType, setSectionConfig, setKeywords, setWizardStepStatus]);

  const handleRunSearch = useCallback(async () => {
    if (!id || !project) return;
    setIsRunning(true);
    setError(null);
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
      const msg = err instanceof Error ? err.message : "文献检索失败，请重试";
      console.error("Search step failed:", err);
      setError(msg);
      setWizardStepStatus(2, "pending");
    } finally {
      setIsRunning(false);
    }
  }, [id, project, projectKeywords, setPapers, setWizardStepStatus]);

  const handleRunExtract = useCallback(async () => {
    if (!id || !project) return;
    setIsRunning(true);
    setError(null);
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
      const msg = err instanceof Error ? err.message : "观点提取失败，请重试";
      console.error("Extract step failed:", err);
      setError(msg);
      setWizardStepStatus(3, "pending");
    } finally {
      setIsRunning(false);
    }
  }, [id, project, papers, setViewpoints, selectAllViewpoints, setWizardStepStatus]);

  const handleRunOutline = useCallback(async () => {
    if (!id || !project) return;
    setIsRunning(true);
    setError(null);
    setWizardStepStatus(4, "running");
    try {
      const selectedVps = viewpoints.filter((_, i) => selectedViewpointIndices.has(i));
      const result = await stepOutline({
        projectId: id,
        viewpoints: selectedVps,
        topic: project.topic,
        totalWordCount,
        language,
        paperType,
        paperCount: papers.filter(p => p.selected).length,
      });
      setOutlineSections(result.sections);
      setOutlineRationale(result.rationale);
      setSectionConfig(result.sections.map(s => ({
        type: s.type, title: s.title, enabled: s.enabled, wordCount: s.wordCount, order: s.order,
      })));
      setWizardStepStatus(4, "review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "大纲生成失败，请重试";
      console.error("Outline step failed:", err);
      setError(msg);
      setWizardStepStatus(4, "pending");
    } finally {
      setIsRunning(false);
    }
  }, [id, project, viewpoints, selectedViewpointIndices, totalWordCount, language, paperType, papers, setSectionConfig, setWizardStepStatus]);

  const handleRunWrite = useCallback(async () => {
    if (!id || !project) return;
    setIsRunning(true);
    setError(null);
    setWizardStepStatus(5, "running");
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
      setWizardStepStatus(5, "review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "论文撰写失败，请重试";
      console.error("Write step failed:", err);
      setError(msg);
      setWizardStepStatus(5, "pending");
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
      } else if (wizardStep === 4) {
        stepData.sectionConfig = sectionConfig;
      }
      await stepConfirm(id, wizardStep, stepData);
      setWizardStepStatus(wizardStep, "confirmed");
      if (wizardStep < 6) {
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
      for (let s = showRollbackDialog + 1; s <= 6; s++) {
        setWizardStepStatus(s as WizardStep, "pending");
      }
      if (showRollbackDialog <= 1) {
        setPapers([]);
        setViewpoints([]);
        setOutlineSections([]);
        setGeneratedSections([]);
        setReferences([]);
      } else if (showRollbackDialog <= 2) {
        setViewpoints([]);
        setOutlineSections([]);
        setGeneratedSections([]);
        setReferences([]);
      } else if (showRollbackDialog <= 3) {
        setOutlineSections([]);
        setGeneratedSections([]);
        setReferences([]);
      } else if (showRollbackDialog <= 4) {
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
  const confirmLabel = wizardStep === 5 ? "确认论文" : wizardStep === 6 ? "完成" : "确认并继续";

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
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-700">{error}</p>
                {error.includes("API key") && (
                  <p className="text-xs text-red-500 mt-1">
                    请检查 <code className="bg-red-100 px-1 rounded">.env</code> 文件中的 API Key 配置是否正确。
                  </p>
                )}
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                <X size={16} />
              </button>
            </div>
          )}
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
            <StepOutline
              projectId={id!} topic={project.topic} viewpoints={viewpoints}
              totalWordCount={totalWordCount} language={language} paperType={paperType}
              paperCount={papers.filter(p => p.selected).length}
              isRunning={isRunning} onRun={handleRunOutline}
              outlineSections={outlineSections} rationale={outlineRationale}
              sectionConfig={sectionConfig}
              onSectionConfigChange={setSectionConfig}
              onOutlineSectionsChange={setOutlineSections}
            />
          )}
          {wizardStep === 5 && (
            <StepWriting
              isRunning={isRunning} onRun={handleRunWrite}
              sections={generatedSections} references={references}
              integrityReport={integrityReport} aigcPatternCount={aigcPatternCount}
              onSectionChange={handleSectionChange} onReorder={handleReorder}
              uploadedImages={uploadedImages} onImageUpload={setUploadedImage}
              projectTitle={project.title} projectKeywords={projectKeywords}
            />
          )}
          {wizardStep === 6 && (
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
              步骤 {wizardStep}/6
            </span>
            {wizardStep < 6 && (
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
              回溯到步骤 {showRollbackDialog} 后，步骤 {showRollbackDialog + 1} 到 6 的结果将被清除，需要重新执行。是否继续？
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

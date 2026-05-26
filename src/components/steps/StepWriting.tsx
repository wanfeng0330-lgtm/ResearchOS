import { Loader2, ShieldCheck, ScanSearch } from "lucide-react";
import ContentEditor from "@/components/ContentEditor";
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

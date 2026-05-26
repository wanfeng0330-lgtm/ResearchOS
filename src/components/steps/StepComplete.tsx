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

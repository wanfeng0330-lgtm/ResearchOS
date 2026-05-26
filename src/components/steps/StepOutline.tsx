import { useState } from "react";
import { Loader2, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import type { OutlineSection, SectionConfig, PaperType } from "../../../shared/types";

interface StepOutlineProps {
  projectId: string;
  topic: string;
  viewpoints: string[];
  totalWordCount: number;
  language: "en" | "zh";
  paperType: PaperType;
  paperCount: number;
  isRunning: boolean;
  onRun: () => Promise<void>;
  outlineSections: OutlineSection[];
  rationale: string;
  sectionConfig: SectionConfig[];
  onSectionConfigChange: (config: SectionConfig[]) => void;
  onOutlineSectionsChange: (sections: OutlineSection[]) => void;
}

export default function StepOutline({
  isRunning, onRun, outlineSections, rationale, sectionConfig,
  onSectionConfigChange, onOutlineSectionsChange,
}: StepOutlineProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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

    if (outlineSections.length > 0) {
      const updatedOutline = outlineSections.map((s, i) =>
        i === index ? { ...s, wordCount: Math.max(50, wordCount) } : s
      );
      onOutlineSectionsChange(updatedOutline);
    }
  };

  const handleSectionTitle = (index: number, title: string) => {
    const updated = sectionConfig.map((s, i) =>
      i === index ? { ...s, title } : s
    );
    onSectionConfigChange(updated);

    if (outlineSections.length > 0) {
      const updatedOutline = outlineSections.map((s, i) =>
        i === index ? { ...s, title } : s
      );
      onOutlineSectionsChange(updatedOutline);
    }
  };

  const totalPlanned = sectionConfig.reduce((sum, s) => sum + (s.enabled ? s.wordCount : 0), 0);

  if (outlineSections.length === 0 && !isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold text-navy-700 mb-2">第四步：生成论文大纲</h2>
          <p className="text-sm text-navy-400 mb-6">AI 将基于提取的观点智能生成论文结构和字数分配</p>
          <button onClick={onRun} className="btn-primary flex items-center gap-2 mx-auto">
            <Lightbulb size={16} />
            生成大纲
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {isRunning && (
          <div className="flex items-center gap-3 text-cyan">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">正在基于观点生成论文大纲...</span>
          </div>
        )}

        {rationale && (
          <div className="p-3 bg-cyan/5 border border-cyan/10 rounded-lg">
            <p className="text-xs text-navy-500 leading-relaxed">
              <span className="font-medium text-cyan">AI 设计理由：</span>{rationale}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-navy-600">
            {sectionConfig.filter(s => s.enabled).length} 个章节
          </span>
          <span className="text-xs text-navy-400">
            总计 {totalPlanned} 字
          </span>
        </div>

        {outlineSections.length > 0 ? outlineSections.map((section, i) => (
          <div key={i} className={`border rounded-lg transition-all ${
            section.enabled ? "border-navy-100 bg-white" : "border-navy-50 bg-navy-50/30"
          }`}>
            <div className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={section.enabled}
                onChange={() => handleToggleSection(i)}
                className="w-4 h-4 accent-[#00E5C7]"
              />
              <span className="text-xs text-navy-300 w-6">{i + 1}.</span>
              <input
                value={section.title}
                onChange={(e) => handleSectionTitle(i, e.target.value)}
                className={`flex-1 text-sm font-medium outline-none bg-transparent ${
                  section.enabled ? "text-navy-700" : "text-navy-300 line-through"
                }`}
              />
              <input
                type="number"
                value={section.wordCount}
                onChange={(e) => handleSectionWordCount(i, parseInt(e.target.value) || 100)}
                className="w-20 px-2 py-1 text-xs border border-navy-200 rounded text-center outline-none focus:ring-1 focus:ring-cyan/30"
                disabled={!section.enabled}
              />
              <span className="text-xs text-navy-400">字</span>
              {(section.keyPoints.length > 0 || section.sourceHints.length > 0) && (
                <button
                  onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                  className="p-1 text-navy-300 hover:text-cyan transition-colors"
                >
                  {expandedIndex === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
            </div>

            {expandedIndex === i && (section.keyPoints.length > 0 || section.sourceHints.length > 0) && (
              <div className="px-4 pb-3 space-y-2 border-t border-navy-50">
                {section.keyPoints.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-navy-400 uppercase tracking-wider mb-1">核心要点</p>
                    <ul className="space-y-0.5">
                      {section.keyPoints.map((point, j) => (
                        <li key={j} className="text-xs text-navy-600 flex items-start gap-1.5">
                          <span className="text-cyan mt-0.5">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {section.sourceHints.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-navy-400 uppercase tracking-wider mb-1">观点来源</p>
                    <ul className="space-y-0.5">
                      {section.sourceHints.map((hint, j) => (
                        <li key={j} className="text-xs text-navy-500 flex items-start gap-1.5">
                          <span className="text-amber-400 mt-0.5">→</span>
                          {hint}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )) : sectionConfig.map((section, i) => (
          <div key={i} className={`border rounded-lg transition-all ${
            section.enabled ? "border-navy-100 bg-white" : "border-navy-50 bg-navy-50/30"
          }`}>
            <div className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={section.enabled}
                onChange={() => handleToggleSection(i)}
                className="w-4 h-4 accent-[#00E5C7]"
              />
              <span className="text-xs text-navy-300 w-6">{i + 1}.</span>
              <input
                value={section.title}
                onChange={(e) => handleSectionTitle(i, e.target.value)}
                className={`flex-1 text-sm font-medium outline-none bg-transparent ${
                  section.enabled ? "text-navy-700" : "text-navy-300 line-through"
                }`}
              />
              <input
                type="number"
                value={section.wordCount}
                onChange={(e) => handleSectionWordCount(i, parseInt(e.target.value) || 100)}
                className="w-20 px-2 py-1 text-xs border border-navy-200 rounded text-center outline-none focus:ring-1 focus:ring-cyan/30"
                disabled={!section.enabled}
              />
              <span className="text-xs text-navy-400">字</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

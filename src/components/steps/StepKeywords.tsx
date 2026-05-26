import { useState } from "react";
import { Plus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import KeywordTag from "@/components/KeywordTag";
import type { SectionConfig, PaperType } from "../../../shared/types";

interface StepKeywordsProps {
  projectId: string;
  topic: string;
  description: string;
  language: "en" | "zh";
  totalWordCount: number;
  paperType: PaperType;
  isRunning: boolean;
  onRun: () => Promise<void>;
  keywords: string[];
  mainKeywords: string[];
  secondaryKeywords: string[];
  researchFields: string[];
  sectionConfig: SectionConfig[];
  onKeywordsChange: (keywords: string[], main: string[], secondary: string[], fields: string[]) => void;
  onSectionConfigChange: (config: SectionConfig[]) => void;
}

export default function StepKeywords({
  isRunning, onRun, keywords, mainKeywords, secondaryKeywords,
  researchFields, sectionConfig, onKeywordsChange, onSectionConfigChange,
}: StepKeywordsProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [showSections, setShowSections] = useState(false);

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    const updated = [...keywords, newKeyword.trim()];
    onKeywordsChange(updated, mainKeywords, secondaryKeywords, researchFields);
    setNewKeyword("");
  };

  const handleRemoveKeyword = (kw: string) => {
    const updated = keywords.filter(k => k !== kw);
    const main = mainKeywords.filter(k => k !== kw);
    const secondary = secondaryKeywords.filter(k => k !== kw);
    onKeywordsChange(updated, main, secondary, researchFields);
  };

  const handleEditKeyword = (oldText: string, newText: string) => {
    const updated = keywords.map(k => k === oldText ? newText : k);
    const main = mainKeywords.map(k => k === oldText ? newText : k);
    const secondary = secondaryKeywords.map(k => k === oldText ? newText : k);
    onKeywordsChange(updated, main, secondary, researchFields);
  };

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
  };

  if (keywords.length === 0 && !isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold text-navy-700 mb-2">第一步：提取关键词</h2>
          <p className="text-sm text-navy-400 mb-6">AI 将根据您的研究主题提取关键词并规划论文结构</p>
          <button onClick={onRun} className="btn-primary flex items-center gap-2 mx-auto">
            <Plus size={16} />
            开始提取关键词
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {isRunning && (
          <div className="flex items-center gap-3 text-cyan">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">正在提取关键词和规划章节...</span>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-navy-700 mb-3">核心关键词</h3>
          <div className="flex flex-wrap gap-2">
            {mainKeywords.map((kw) => (
              <KeywordTag key={kw} text={kw} color="blue" onRemove={() => handleRemoveKeyword(kw)} onEdit={(t) => handleEditKeyword(kw, t)} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-navy-700 mb-3">次要关键词</h3>
          <div className="flex flex-wrap gap-2">
            {secondaryKeywords.map((kw) => (
              <KeywordTag key={kw} text={kw} color="gray" onRemove={() => handleRemoveKeyword(kw)} onEdit={(t) => handleEditKeyword(kw, t)} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-navy-700 mb-3">研究领域</h3>
          <div className="flex flex-wrap gap-2">
            {researchFields.map((field) => (
              <KeywordTag key={field} text={field} color="green" onRemove={() => handleRemoveKeyword(field)} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
            placeholder="添加关键词..."
            className="flex-1 px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-2 focus:ring-cyan/20"
          />
          <button onClick={handleAddKeyword} className="btn-secondary text-sm flex items-center gap-1">
            <Plus size={14} />
            添加
          </button>
        </div>

        <div className="border-t border-navy-100 pt-4">
          <button
            onClick={() => setShowSections(!showSections)}
            className="flex items-center gap-2 text-sm font-medium text-navy-600 hover:text-cyan transition-colors"
          >
            {showSections ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            章节规划（{sectionConfig.filter(s => s.enabled).length} 个章节）
          </button>
          {showSections && (
            <div className="mt-3 space-y-2">
              {sectionConfig.map((section, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-navy-50/50">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={() => handleToggleSection(i)}
                    className="w-4 h-4 accent-[#00E5C7]"
                  />
                  <span className={`text-sm flex-1 ${section.enabled ? "text-navy-700" : "text-navy-300 line-through"}`}>
                    {section.title}
                  </span>
                  <input
                    type="number"
                    value={section.wordCount}
                    onChange={(e) => handleSectionWordCount(i, parseInt(e.target.value) || 100)}
                    className="w-20 px-2 py-1 text-xs border border-navy-200 rounded text-center outline-none focus:ring-1 focus:ring-cyan/30"
                  />
                  <span className="text-xs text-navy-400">字</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { GripVertical, Plus, Trash2, ChevronUp, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import type { SectionConfig } from "../../shared/types";
import useAppStore from "@/store/useAppStore";
import { planSections } from "@/utils/api";

interface SectionConfiguratorProps {
  sectionConfig: SectionConfig[];
  onUpdateSection: (type: string, updates: Partial<SectionConfig>) => void;
  onSetSectionConfig: (config: SectionConfig[]) => void;
  totalWordCount: number;
  onSetTotalWordCount: (count: number) => void;
  topic?: string;
  description?: string;
}

const LOCKED_TYPES = ["abstract", "introduction", "conclusion"];

export default function SectionConfigurator({
  sectionConfig,
  onUpdateSection,
  onSetSectionConfig,
  totalWordCount,
  onSetTotalWordCount,
  topic,
  description,
}: SectionConfiguratorProps) {
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const language = useAppStore((s) => s.language);
  const wordUnit = language === "en" ? "词" : "字";

  const sorted = [...sectionConfig].sort((a, b) => a.order - b.order);
  const enabledWordCount = sorted
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + s.wordCount, 0);

  const handleToggle = (section: SectionConfig) => {
    if (LOCKED_TYPES.includes(section.type)) return;
    onUpdateSection(section.type, { enabled: !section.enabled });
  };

  const handleWordCountChange = (type: string, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      onUpdateSection(type, { wordCount: num });
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newConfig = [...sorted];
    [newConfig[index - 1], newConfig[index]] = [newConfig[index], newConfig[index - 1]];
    onSetSectionConfig(newConfig.map((s, i) => ({ ...s, order: i })));
  };

  const handleMoveDown = (index: number) => {
    if (index === sorted.length - 1) return;
    const newConfig = [...sorted];
    [newConfig[index], newConfig[index + 1]] = [newConfig[index + 1], newConfig[index]];
    onSetSectionConfig(newConfig.map((s, i) => ({ ...s, order: i })));
  };

  const handleDelete = (type: string) => {
    if (LOCKED_TYPES.includes(type)) return;
    const filtered = sorted.filter((s) => s.type !== type);
    onSetSectionConfig(filtered.map((s, i) => ({ ...s, order: i })));
  };

  const handleAddSection = () => {
    if (!newSectionTitle.trim()) return;
    const customType = `custom_${Date.now()}`;
    const newSection: SectionConfig = {
      type: customType,
      title: newSectionTitle.trim(),
      enabled: true,
      wordCount: 500,
      order: sorted.length,
    };
    onSetSectionConfig([...sorted, newSection].map((s, i) => ({ ...s, order: i })));
    setNewSectionTitle("");
  };

  const handleAIPlan = async () => {
    if (!topic || isPlanning) return;
    setIsPlanning(true);
    try {
      const result = await planSections(topic, description || "", totalWordCount, language);
      if (result && result.length > 0) {
        onSetSectionConfig(result);
      }
    } catch {
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
      <button
        onClick={handleAIPlan}
        disabled={isPlanning || !topic}
        className="w-full mb-4 btn-primary text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"
      >
        {isPlanning ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Sparkles size={14} />
        )}
        AI智能配置
      </button>
      <div className="space-y-2">
        {sorted.map((section, index) => {
          const isLocked = LOCKED_TYPES.includes(section.type);
          return (
            <motion.div
              key={section.type}
              layout
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                section.enabled
                  ? "bg-white border-navy-100"
                  : "bg-navy-50/50 border-navy-100/50 opacity-60"
              }`}
            >
              <GripVertical size={16} className="text-navy-200 shrink-0" />

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-0.5 rounded hover:bg-navy-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronUp size={14} className="text-navy-400" />
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === sorted.length - 1}
                  className="p-0.5 rounded hover:bg-navy-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronDown size={14} className="text-navy-400" />
                </button>
              </div>

              <span className="font-medium text-sm text-navy-700 min-w-[80px]">
                {section.title}
              </span>

              <div className="flex-1" />

              <button
                onClick={() => handleToggle(section)}
                disabled={isLocked}
                className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                  section.enabled ? "bg-cyan" : "bg-navy-200"
                } ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    section.enabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  value={section.wordCount}
                  onChange={(e) => handleWordCountChange(section.type, e.target.value)}
                  className="w-16 text-center text-xs border border-navy-100 rounded-md px-1.5 py-1 text-navy-600 focus:outline-none focus:ring-1 focus:ring-cyan/30"
                  min={0}
                  step={100}
                />
                <span className="text-[10px] text-navy-400">{wordUnit}</span>
              </div>

              {!isLocked && (
                <button
                  onClick={() => handleDelete(section.type)}
                  className="p-1 rounded hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 size={14} className="text-red-400" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={newSectionTitle}
          onChange={(e) => setNewSectionTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
          placeholder="自定义章节名称"
          className="flex-1 text-sm border border-navy-100 rounded-lg px-3 py-2 text-navy-600 placeholder:text-navy-300 focus:outline-none focus:ring-1 focus:ring-cyan/30"
        />
        <button
          onClick={handleAddSection}
          disabled={!newSectionTitle.trim()}
          className="btn-secondary text-sm flex items-center gap-1 shrink-0 disabled:opacity-40"
        >
          <Plus size={14} />
          添加章节
        </button>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-navy-50/50 border border-navy-100/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-navy-500">总字数目标</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={totalWordCount}
              onChange={(e) => {
                const num = parseInt(e.target.value, 10);
                if (!isNaN(num) && num >= 0) onSetTotalWordCount(num);
              }}
              className="w-20 text-center text-sm border border-navy-100 rounded-md px-2 py-1 text-navy-700 font-medium focus:outline-none focus:ring-1 focus:ring-cyan/30"
              min={0}
              step={500}
            />
            <span className="text-xs text-navy-400">{wordUnit}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-navy-500">已分配字数</span>
          <span className={`text-sm font-medium ${
            enabledWordCount > totalWordCount ? "text-red-500" : "text-cyan"
          }`}>
            {enabledWordCount} {wordUnit}
          </span>
        </div>
        <div className="mt-2 h-1.5 bg-navy-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              enabledWordCount > totalWordCount
                ? "bg-red-400"
                : "bg-gradient-to-r from-cyan-500 to-cyan-400"
            }`}
            style={{ width: `${Math.min((enabledWordCount / totalWordCount) * 100, 100)}%` }}
          />
        </div>
        {enabledWordCount > totalWordCount && (
          <p className="text-[11px] text-red-400 mt-1.5">
            已分配字数超过总字数目标
          </p>
        )}
      </div>
    </div>
  );
}

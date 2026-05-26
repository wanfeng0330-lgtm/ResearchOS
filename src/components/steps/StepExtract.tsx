import { useState } from "react";
import { Loader2, Plus, CheckSquare, Square } from "lucide-react";
import ViewpointCard from "@/components/ViewpointCard";

interface StepExtractProps {
  isRunning: boolean;
  onRun: () => Promise<void>;
  viewpoints: string[];
  selectedIndices: Set<number>;
  onToggleSelect: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onEditViewpoint: (index: number, newText: string) => void;
  onDeleteViewpoint: (index: number) => void;
  onAddViewpoint: (text: string) => void;
}

export default function StepExtract({
  isRunning, onRun, viewpoints, selectedIndices,
  onToggleSelect, onSelectAll, onDeselectAll,
  onEditViewpoint, onDeleteViewpoint, onAddViewpoint,
}: StepExtractProps) {
  const [newViewpoint, setNewViewpoint] = useState("");

  const handleAdd = () => {
    if (!newViewpoint.trim()) return;
    onAddViewpoint(newViewpoint.trim());
    setNewViewpoint("");
  };

  if (viewpoints.length === 0 && !isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold text-navy-700 mb-2">第三步：观点提取</h2>
          <p className="text-sm text-navy-400 mb-6">AI 将从选定文献中提取核心观点和研究发现</p>
          <button onClick={onRun} className="btn-primary flex items-center gap-2 mx-auto">
            开始提取观点
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
          <span className="text-sm font-medium">正在提取研究观点...</span>
        </div>
      )}

      <div className="px-6 py-3 border-b border-navy-100 flex items-center justify-between bg-ivory/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-navy-600">
            {viewpoints.length} 个观点
          </span>
          <span className="text-xs text-cyan bg-cyan/10 px-2 py-0.5 rounded-full">
            已选 {selectedIndices.size} 个
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSelectAll} className="text-xs text-navy-500 hover:text-cyan flex items-center gap-1">
            <CheckSquare size={12} /> 全选
          </button>
          <button onClick={onDeselectAll} className="text-xs text-navy-500 hover:text-cyan flex items-center gap-1">
            <Square size={12} /> 取消全选
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-3">
        {viewpoints.map((vp, i) => (
          <ViewpointCard
            key={i}
            text={vp}
            index={i}
            selected={selectedIndices.has(i)}
            onToggleSelect={onToggleSelect}
            onEdit={onEditViewpoint}
            onDelete={onDeleteViewpoint}
          />
        ))}
      </div>

      <div className="px-6 py-3 border-t border-navy-100 bg-ivory/50">
        <div className="flex items-center gap-2">
          <input
            value={newViewpoint}
            onChange={(e) => setNewViewpoint(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="手动添加观点..."
            className="flex-1 px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30"
          />
          <button onClick={handleAdd} disabled={!newViewpoint.trim()} className="btn-secondary text-sm flex items-center gap-1">
            <Plus size={14} />
            添加
          </button>
        </div>
      </div>
    </div>
  );
}

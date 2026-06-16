import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import PaperCard from "@/components/PaperCard";
import type { Paper } from "../../../shared/types";

interface StepSearchProps {
  isRunning: boolean;
  onRun: () => Promise<void>;
  papers: Paper[];
  onTogglePaper: (id: string) => void;
  onAddExternalPaper: (paper: Paper) => void;
}

export default function StepSearch({ isRunning, onRun, papers, onTogglePaper, onAddExternalPaper }: StepSearchProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [extTitle, setExtTitle] = useState("");
  const [extAuthors, setExtAuthors] = useState("");
  const [extAbstract, setExtAbstract] = useState("");
  const [extYear, setExtYear] = useState(new Date().getFullYear().toString());
  const [extDoi, setExtDoi] = useState("");

  const selectedCount = papers.filter(p => p.selected).length;
  const sourceCounts = papers.reduce((acc, p) => {
    acc[p.source] = (acc[p.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sourceLabels: Record<string, string> = {
    arxiv: 'arXiv',
    semantic_scholar: 'Semantic Scholar',
    crossref: 'CrossRef',
    openalex: 'OpenAlex',
    pubmed: 'PubMed',
    biorxiv: 'bioRxiv',
    unpaywall: 'Unpaywall',
    openalex_fallback: 'OpenAlex(降级)',
  };

  const handleAddExternal = () => {
    if (!extTitle.trim()) return;
    const paper: Paper = {
      id: `ext-${Date.now()}`,
      projectId: "",
      title: extTitle.trim(),
      authors: extAuthors.split(",").map(a => a.trim()).filter(Boolean),
      year: parseInt(extYear) || new Date().getFullYear(),
      abstract: extAbstract.trim(),
      source: "crossref",
      sourceId: `ext-${Date.now()}`,
      doi: extDoi.trim() || undefined,
      selected: true,
    };
    onAddExternalPaper(paper);
    setExtTitle("");
    setExtAuthors("");
    setExtAbstract("");
    setExtYear(new Date().getFullYear().toString());
    setExtDoi("");
    setShowAddForm(false);
  };

  if (papers.length === 0 && !isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold text-navy-700 mb-2">第二步：文献检索</h2>
          <p className="text-sm text-navy-400 mb-2">AI 将在 4 个学术数据库中检索文献</p>
          <p className="text-xs text-navy-300 mb-6">OpenAlex · CrossRef · PubMed · Semantic Scholar · bioRxiv · arXiv → AI筛选Top30</p>
          <button onClick={onRun} className="btn-primary flex items-center gap-2 mx-auto">
            开始检索文献
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
          <span className="text-sm font-medium">正在检索文献：4源各25篇 → AI四维评分筛选Top30...</span>
        </div>
      )}

      <div className="px-6 py-3 border-b border-navy-100 flex items-center justify-between bg-ivory/50">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-navy-600">
            {papers.length} 篇文献（AI筛选Top30）
          </span>
          <span className="text-xs text-cyan bg-cyan/10 px-2 py-0.5 rounded-full">
            已选 {selectedCount} 篇
          </span>
          {Object.entries(sourceCounts).map(([source, count]) => (
            <span key={source} className="text-xs text-navy-400 bg-navy-50 px-2 py-0.5 rounded-full">
              {sourceLabels[source] || source}: {count}
            </span>
          ))}
          {papers.length > 0 && (
            <span className="text-xs text-navy-300">
              评分: 关键词×0.25 + 主题×0.35 + 方法×0.20 + 贡献×0.20
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-secondary text-xs flex items-center gap-1"
        >
          <Plus size={12} />
          添加文献
        </button>
      </div>

      {showAddForm && (
        <div className="px-6 py-4 border-b border-navy-100 bg-warmgray/30 space-y-3">
          <input value={extTitle} onChange={(e) => setExtTitle(e.target.value)} placeholder="文献标题 *" className="w-full px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30" />
          <div className="flex gap-3">
            <input value={extAuthors} onChange={(e) => setExtAuthors(e.target.value)} placeholder="作者（逗号分隔）" className="flex-1 px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30" />
            <input value={extYear} onChange={(e) => setExtYear(e.target.value)} placeholder="年份" className="w-24 px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30" />
          </div>
          <textarea value={extAbstract} onChange={(e) => setExtAbstract(e.target.value)} placeholder="摘要" rows={2} className="w-full px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30 resize-none" />
          <input value={extDoi} onChange={(e) => setExtDoi(e.target.value)} placeholder="DOI（可选）" className="w-full px-3 py-2 text-sm border border-navy-200 rounded-lg outline-none focus:ring-1 focus:ring-cyan/30" />
          <button onClick={handleAddExternal} disabled={!extTitle.trim()} className="btn-primary text-sm">添加</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-3">
        {papers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} onToggleSelect={onTogglePaper} />
        ))}
      </div>
    </div>
  );
}

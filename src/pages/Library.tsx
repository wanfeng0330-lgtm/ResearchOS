import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, LayoutGrid, List, X, BookOpen } from "lucide-react";
import useAppStore from "@/store/useAppStore";
import PaperCard from "@/components/PaperCard";
import type { Paper } from "../../shared/types";

type SortKey = "year" | "citations" | "title";
type ViewMode = "card" | "table";

const sourceOptions: { value: Paper["source"] | "all"; label: string }[] = [
  { value: "all", label: "全部来源" },
  { value: "arxiv", label: "arXiv" },
  { value: "semantic_scholar", label: "Semantic Scholar" },
  { value: "crossref", label: "CrossRef" },
];

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "year", label: "年份" },
  { value: "citations", label: "引用数" },
  { value: "title", label: "标题" },
];

export default function Library() {
  const { papers, togglePaperSelection } = useAppStore();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<Paper["source"] | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("year");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [detailPaper, setDetailPaper] = useState<Paper | null>(null);

  const filtered = useMemo(() => {
    let list = [...papers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.authors.some((a) => a.toLowerCase().includes(q)) ||
          p.keywords?.some((k) => k.toLowerCase().includes(q))
      );
    }
    if (sourceFilter !== "all") {
      list = list.filter((p) => p.source === sourceFilter);
    }
    list.sort((a, b) => {
      if (sortKey === "year") return b.year - a.year;
      if (sortKey === "citations")
        return (b.citationCount ?? 0) - (a.citationCount ?? 0);
      return a.title.localeCompare(b.title);
    });
    return list;
  }, [papers, search, sourceFilter, sortKey]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="section-title mb-6">文献库</h1>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索文献标题、作者、关键词..."
              className="input-field pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-navy-400" />
            <select
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(e.target.value as Paper["source"] | "all")
              }
              className="input-field text-sm py-2 w-auto"
            >
              {sourceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="input-field text-sm py-2 w-auto"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  按{o.label}排序
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center border border-navy-100 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("card")}
              className={`p-2 transition-colors ${
                viewMode === "card"
                  ? "bg-cyan/10 text-cyan"
                  : "text-navy-300 hover:text-navy-500"
              }`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 transition-colors ${
                viewMode === "table"
                  ? "bg-cyan/10 text-cyan"
                  : "text-navy-300 hover:text-navy-500"
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen size={48} className="mx-auto text-navy-200 mb-4" />
            <p className="text-navy-400 font-serif text-lg mb-1">
              文献库为空
            </p>
            <p className="text-navy-300 text-sm">
              在项目中搜索文献后，文献将自动出现在这里
            </p>
          </div>
        ) : viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((paper, i) => (
              <motion.div
                key={paper.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <PaperCard
                  paper={paper}
                  onToggleSelect={togglePaperSelection}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="card-static overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50">
                  <th className="text-left px-4 py-3 text-navy-500 font-medium">
                    标题
                  </th>
                  <th className="text-left px-4 py-3 text-navy-500 font-medium">
                    作者
                  </th>
                  <th className="text-center px-4 py-3 text-navy-500 font-medium">
                    年份
                  </th>
                  <th className="text-center px-4 py-3 text-navy-500 font-medium">
                    来源
                  </th>
                  <th className="text-center px-4 py-3 text-navy-500 font-medium">
                    引用
                  </th>
                  <th className="text-center px-4 py-3 text-navy-500 font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((paper) => (
                  <tr
                    key={paper.id}
                    className="border-b border-navy-50 hover:bg-warmgray/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-navy-700 max-w-xs truncate">
                      {paper.title}
                    </td>
                    <td className="px-4 py-3 text-navy-500 max-w-[150px] truncate">
                      {paper.authors.slice(0, 2).join(", ")}
                      {paper.authors.length > 2 && " 等"}
                    </td>
                    <td className="px-4 py-3 text-center text-navy-500">
                      {paper.year}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-2 py-0.5 rounded bg-navy-50 text-navy-500">
                        {paper.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-navy-500">
                      {paper.citationCount ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setDetailPaper(paper)}
                        className="text-xs text-cyan-600 hover:text-cyan"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {detailPaper && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetailPaper(null)}
          >
            <motion.div
              className="bg-ivory rounded-2xl p-6 w-full max-w-lg shadow-xl border border-navy-100 max-h-[80vh] overflow-y-auto scrollbar-thin"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-serif font-semibold text-navy-700 text-lg pr-4">
                  {detailPaper.title}
                </h3>
                <button
                  onClick={() => setDetailPaper(null)}
                  className="p-1 rounded-lg hover:bg-navy-50"
                >
                  <X size={18} className="text-navy-400" />
                </button>
              </div>
              <p className="text-sm text-navy-500 mb-3">
                {detailPaper.authors.join(", ")} ({detailPaper.year})
              </p>
              <div className="mb-4">
                <h4 className="text-sm font-medium text-navy-600 mb-1">摘要</h4>
                <p className="text-sm text-navy-500 leading-relaxed">
                  {detailPaper.abstract}
                </p>
              </div>
              {detailPaper.keywords && detailPaper.keywords.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-navy-600 mb-1">
                    关键词
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detailPaper.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-xs px-2 py-0.5 rounded bg-navy-50 text-navy-500"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {detailPaper.bibtex && (
                <div>
                  <h4 className="text-sm font-medium text-navy-600 mb-1">
                    BibTeX
                  </h4>
                  <pre className="text-xs font-mono bg-navy-50 p-3 rounded-lg text-navy-600 overflow-x-auto">
                    {detailPaper.bibtex}
                  </pre>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

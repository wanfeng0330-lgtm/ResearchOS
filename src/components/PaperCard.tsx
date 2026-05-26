import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { Paper } from "../../shared/types";

const sourceLabels: Record<Paper["source"], string> = {
  arxiv: "arXiv",
  semantic_scholar: "Semantic Scholar",
  crossref: "CrossRef",
};

const sourceColors: Record<Paper["source"], string> = {
  arxiv: "bg-red-50 text-red-600 border-red-200",
  semantic_scholar: "bg-blue-50 text-blue-600 border-blue-200",
  crossref: "bg-purple-50 text-purple-600 border-purple-200",
};

interface PaperCardProps {
  paper: Paper;
  onToggleSelect: (id: string) => void;
}

export default function PaperCard({ paper, onToggleSelect }: PaperCardProps) {
  const [expanded, setExpanded] = useState(false);

  const relevancePercent = paper.relevanceScore != null
    ? Math.round(paper.relevanceScore * 100)
    : null;

  const relevanceColor = relevancePercent != null
    ? relevancePercent >= 80
      ? "bg-cyan/20 text-cyan-700 border-cyan/30"
      : relevancePercent >= 50
      ? "bg-cyan/10 text-cyan-600 border-cyan/20"
      : "bg-navy-50 text-navy-400 border-navy-100"
    : "";

  return (
    <motion.div
      layout
      className="card-static p-4 group"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={paper.selected}
          onChange={() => onToggleSelect(paper.id)}
          className="mt-1 w-4 h-4 rounded border-navy-300 text-cyan focus:ring-cyan/30 cursor-pointer accent-[#00E5C7]"
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-navy-700 text-sm leading-snug line-clamp-2">
            {paper.title}
          </h4>
          <p className="text-xs text-navy-400 mt-1">
            {paper.authors.slice(0, 3).join(", ")}
            {paper.authors.length > 3 && " 等"}
            <span className="ml-2">({paper.year})</span>
          </p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                sourceColors[paper.source]
              }`}
            >
              {sourceLabels[paper.source]}
            </span>
            {relevancePercent != null && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${relevanceColor}`}
              >
                相关度 {relevancePercent}%
              </span>
            )}
            {paper.citationCount !== undefined && (
              <span className="text-[10px] text-navy-400">
                引用 {paper.citationCount}
              </span>
            )}
            {paper.pdfUrl && (
              <a
                href={paper.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-cyan-600 hover:text-cyan flex items-center gap-0.5"
              >
                PDF <ExternalLink size={10} />
              </a>
            )}
          </div>

          {relevancePercent != null && (
            <div className="mt-2 h-1 bg-navy-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  relevancePercent >= 80
                    ? "bg-cyan"
                    : relevancePercent >= 50
                    ? "bg-cyan-400"
                    : "bg-navy-200"
                }`}
                style={{ width: `${relevancePercent}%` }}
              />
            </div>
          )}

          {paper.aiScores && (
            <div className="mt-2 p-2 bg-navy-50/50 rounded-md border border-navy-100">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="text-navy-400">关键词重叠</span>
                  <span className="font-medium text-navy-600">{Math.round(paper.aiScores.keywordOverlap * 100)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-navy-400">主题契合</span>
                  <span className="font-medium text-navy-600">{Math.round(paper.aiScores.thematicAlignment * 100)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-navy-400">方法兼容</span>
                  <span className="font-medium text-navy-600">{Math.round(paper.aiScores.methodologyCompatibility * 100)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-navy-400">贡献潜力</span>
                  <span className="font-medium text-navy-600">{Math.round(paper.aiScores.contributionPotential * 100)}%</span>
                </div>
              </div>
              {paper.aiScores.reason && (
                <p className="text-[10px] text-navy-400 mt-1 italic">"{paper.aiScores.reason}"</p>
              )}
            </div>
          )}

          <div className="mt-2">
            <p
              className={`text-xs text-navy-500 leading-relaxed ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {paper.abstract}
            </p>
            {paper.abstract.length > 100 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] text-cyan-600 hover:text-cyan mt-1 flex items-center gap-0.5"
              >
                {expanded ? (
                  <>
                    收起 <ChevronUp size={10} />
                  </>
                ) : (
                  <>
                    展开 <ChevronDown size={10} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

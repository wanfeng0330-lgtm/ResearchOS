import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { CitationFormat, Reference } from "../../shared/types";

const formatTabs: { key: CitationFormat; label: string }[] = [
  { key: "bibtex", label: "BibTeX" },
  { key: "gbt", label: "GB/T" },
  { key: "apa", label: "APA" },
  { key: "ieee", label: "IEEE" },
];

interface CitationPanelProps {
  references: Reference[];
  citationFormat: CitationFormat;
  onFormatChange: (format: CitationFormat) => void;
}

export default function CitationPanel({
  references,
  citationFormat,
  onFormatChange,
}: CitationPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getFormattedText = (ref: Reference): string => {
    switch (citationFormat) {
      case "bibtex":
        return ref.bibtex;
      case "gbt":
        return ref.gbt;
      case "apa":
        return ref.apa;
      case "ieee":
        return ref.ieee;
      default:
        return ref.bibtex;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <h3 className="font-serif font-semibold text-navy-700 mb-3">引用管理</h3>

      <div className="flex gap-1 mb-4 flex-wrap">
        {formatTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onFormatChange(tab.key)}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              citationFormat === tab.key
                ? "bg-cyan/10 text-cyan border border-cyan/30"
                : "text-navy-400 hover:text-navy-600 border border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2">
        {references.length === 0 && (
          <p className="text-xs text-navy-300 text-center py-8">
            暂无引用文献
          </p>
        )}
        {references.map((ref) => (
          <div
            key={ref.id}
            className="p-2.5 rounded-lg bg-navy-50/50 border border-navy-100/50 group"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] text-navy-600 leading-relaxed font-mono flex-1">
                {getFormattedText(ref)}
              </p>
              <button
                onClick={() => handleCopy(ref.id, getFormattedText(ref))}
                className="shrink-0 p-1 rounded hover:bg-navy-100 transition-colors"
              >
                {copiedId === ref.id ? (
                  <Check size={12} className="text-cyan" />
                ) : (
                  <Copy size={12} className="text-navy-300" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

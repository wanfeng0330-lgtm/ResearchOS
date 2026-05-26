import { useState } from "react";
import { GripVertical, BarChart3, Eye, List } from "lucide-react";
import type { GeneratedSection, ChartDefinition } from "../../shared/types";

interface ContentEditorProps {
  sections: GeneratedSection[];
  onSectionChange: (id: string, content: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  projectTitle?: string;
  projectKeywords?: string[];
  includeToc?: boolean;
}

const sectionLabels: Record<string, string> = {
  abstract: "摘要",
  introduction: "引言",
  related_work: "文献综述",
  methodology: "研究方法",
  findings: "研究发现",
  experiments: "实验结果",
  discussion: "讨论",
  limitations: "局限性",
  conclusion: "结论",
};

function ChartPlaceholder({ chart }: { chart: ChartDefinition }) {
  return (
    <div className="mt-3 border border-navy-100 rounded-lg p-4 bg-navy-50/30">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 size={16} className="text-cyan-500" />
        <span className="text-xs font-medium text-navy-600">{chart.title}</span>
      </div>
      <div className="h-32 rounded-md bg-navy-50/50 border border-dashed border-navy-200 flex items-center justify-center">
        {typeof chart.data?.imageUrl === "string" ? (
          <img
            src={chart.data.imageUrl}
            alt={chart.title}
            className="max-h-full max-w-full object-contain rounded"
          />
        ) : (
          <div className="text-center">
            <BarChart3 size={24} className="text-navy-200 mx-auto mb-1" />
            <p className="text-[10px] text-navy-300">
              {chart.type === "bar" && "柱状图"}
              {chart.type === "line" && "折线图"}
              {chart.type === "pie" && "饼图"}
              {chart.type === "scatter" && "散点图"}
              {chart.type === "heatmap" && "热力图"}
              {chart.type === "flowchart" && "流程图"}
              {chart.type === "network" && "网络图"}
            </p>
          </div>
        )}
      </div>
      {chart.caption && (
        <p className="text-[10px] text-navy-400 mt-2 text-center">
          {chart.caption}
        </p>
      )}
    </div>
  );
}

function formatPreviewContent(text: string, sectionIndex?: number): React.ReactNode[] {
  let s = text;
  s = s.replace(/\\cite\{[^}]*\}/g, "[?]");
  s = s.replace(/\\textbf\{([^}]*)\}/g, "**$1**");
  s = s.replace(/\\textit\{([^}]*)\}/g, "*$1*");
  s = s.replace(/\\emph\{([^}]*)\}/g, "*$1*");
  s = s.replace(/\\\\/g, "\n");
  s = s.replace(/\\n/g, "\n");
  s = s.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1");
  s = s.replace(/---/g, "\u2014");
  s = s.replace(/--/g, "\u2013");

  const lines = s.split("\n");
  const elements: React.ReactNode[] = [];
  let h2Counter = 0;
  let h3Counter = 0;

  const h3Count = lines.filter((l) => /^###\s/.test(l.trim())).length;
  const shouldDemoteH3 = h3Count > 0 && h3Count < 3;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^#{1,4}\s/.test(trimmed)) {
      let level = trimmed.match(/^(#{1,4})/)?.[1].length || 1;
      let headingText = trimmed.replace(/^#{1,4}\s+/, "");

      if (shouldDemoteH3 && level === 3) {
        elements.push(
          <p key={`p-${lineIdx}`} className="text-sm text-navy-600 leading-relaxed mb-2 font-semibold">
            {headingText}
          </p>
        );
        continue;
      }

      if (sectionIndex !== undefined && level === 2) {
        h2Counter++;
        h3Counter = 0;
        headingText = `${sectionIndex + 1}.${h2Counter} ${headingText}`;
      } else if (sectionIndex !== undefined && level === 3) {
        h3Counter++;
        headingText = `${sectionIndex + 1}.${h2Counter}.${h3Counter} ${headingText}`;
      }

      const headingClasses: Record<number, string> = {
        1: "text-base font-bold text-navy-800 mt-4 mb-2",
        2: "text-sm font-bold text-navy-700 mt-3 mb-1.5",
        3: "text-sm font-semibold text-navy-600 mt-2 mb-1",
        4: "text-xs font-semibold text-navy-500 mt-2 mb-1",
      };
      elements.push(
        <div key={`h-${lineIdx}`} className={headingClasses[level] || headingClasses[3]}>
          {headingText}
        </div>
      );
    } else {
      elements.push(
        <p key={`p-${lineIdx}`} className="text-sm text-navy-600 leading-relaxed mb-2 text-indent">
          {renderInlineFormatting(trimmed)}
        </p>
      );
    }
  }

  return elements;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const parts = text.split(/(\[\d+\]|\[\?\]|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (/^\[\d+\]$/.test(part) || /^\[\?\]$/.test(part)) {
      return (
        <sup key={i} className="text-cyan font-medium text-[11px]">
          {part}
        </sup>
      );
    }
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={i} className="font-semibold text-navy-700">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^\*[^*]+\*$/.test(part)) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function TocSection({ sections }: { sections: GeneratedSection[] }) {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const bodySections = sorted.filter((s) => s.type !== "abstract");

  return (
    <div className="mb-6 pb-4 border-b border-navy-100">
      <div className="flex items-center gap-2 mb-3">
        <List size={14} className="text-navy-500" />
        <h3 className="font-serif font-bold text-navy-700 text-sm">目录</h3>
      </div>
      <nav className="space-y-1">
        {bodySections.map((section, idx) => (
          <div key={section.id} className="flex items-center gap-2 text-xs text-navy-500 hover:text-cyan transition-colors cursor-pointer">
            <span className="font-medium min-w-[20px]">{idx + 1}</span>
            <span>{section.title || sectionLabels[section.type] || section.type}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs text-navy-500 hover:text-cyan transition-colors cursor-pointer">
          <span className="font-medium min-w-[20px]">{bodySections.length + 1}</span>
          <span>参考文献</span>
        </div>
      </nav>
    </div>
  );
}

export default function ContentEditor({
  sections,
  onSectionChange,
  onReorder,
  projectTitle,
  projectKeywords,
  includeToc = true,
}: ContentEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");

  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const abstractSection = sorted.find((s) => s.type === "abstract");
  const bodySections = sorted.filter((s) => s.type !== "abstract");

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    onReorder(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  if (sorted.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-navy-300">
        <div className="text-center">
          <Eye size={32} className="mx-auto mb-3 text-navy-200" />
          <p className="font-serif text-lg mb-1">论文预览</p>
          <p className="text-sm">点击"生成论文"开始生成，完成后可在此预览完整论文</p>
        </div>
      </div>
    );
  }

  if (viewMode === "preview") {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-navy-100/50 p-8 md:p-12">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setViewMode("edit")}
                className="text-xs text-navy-400 hover:text-cyan transition-colors flex items-center gap-1"
              >
                <GripVertical size={12} />
                编辑模式
              </button>
            </div>

            <div className="text-center mb-6">
              <h1 className="font-serif text-2xl font-bold text-navy-800 leading-tight" style={{ fontSize: "22pt" }}>
                {projectTitle || "论文标题"}
              </h1>
            </div>

            {abstractSection && (
              <div className="mb-6">
                <div className="text-center mb-3">
                  <h2 className="font-serif font-bold text-navy-700 text-base">摘 要</h2>
                </div>
                <div className="text-sm text-navy-600 leading-relaxed text-indent">
                  {formatPreviewContent(abstractSection.content)}
                </div>
                {projectKeywords && projectKeywords.length > 0 && (
                  <div className="mt-3 text-sm">
                    <span className="font-bold text-navy-700">关键词：</span>
                    <span className="text-navy-600">{projectKeywords.join("；")}</span>
                  </div>
                )}
              </div>
            )}

            {includeToc && <TocSection sections={sorted} />}

            {bodySections.map((section, idx) => (
              <div key={section.id} className="mb-6">
                <h2 className="font-serif font-bold text-navy-800 text-base mb-3">
                  {idx + 1} {section.title || sectionLabels[section.type] || section.type}
                </h2>
                {formatPreviewContent(section.content, idx)}

                {section.charts && section.charts.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {section.charts.map((chart) => (
                      <ChartPlaceholder key={chart.id} chart={chart} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="mt-8 pt-4 border-t border-navy-100">
              <h2 className="font-serif font-bold text-navy-800 text-base mb-3">
                {bodySections.length + 1} 参考文献
              </h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setViewMode("preview")}
            className="text-xs text-navy-400 hover:text-cyan transition-colors flex items-center gap-1"
          >
            <Eye size={12} />
            预览模式
          </button>
        </div>

        <div className="space-y-4 pr-2">
          {sorted.map((section, index) => (
            <div
              key={section.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`card-static p-4 cursor-default ${
                dragIndex === index ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <GripVertical
                  size={16}
                  className="text-navy-200 cursor-grab active:cursor-grabbing"
                />
                <h3 className="font-serif font-semibold text-navy-700">
                  {section.title || sectionLabels[section.type] || section.type}
                </h3>
                <span className="text-[10px] text-navy-300 bg-navy-50 px-2 py-0.5 rounded">
                  {sectionLabels[section.type] || section.type}
                </span>
              </div>

              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  onSectionChange(section.id, e.currentTarget.textContent || "")
                }
                className="text-sm text-navy-600 leading-relaxed outline-none min-h-[80px] focus:ring-2 focus:ring-cyan/20 rounded p-1 -m-1 transition-shadow"
              >
                {formatPreviewContent(section.content)}
              </div>

              {section.charts && section.charts.length > 0 && (
                <div className="mt-2 space-y-2">
                  {section.charts.map((chart) => (
                    <ChartPlaceholder key={chart.id} chart={chart} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

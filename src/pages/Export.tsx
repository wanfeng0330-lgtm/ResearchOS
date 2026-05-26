import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, FileDown, Code, Type as TypstIcon, Download, Loader2, CheckCircle, Info } from "lucide-react";
import useAppStore from "@/store/useAppStore";
import { exportDocument, downloadFile } from "@/utils/api";
import type { ExportFormat, CitationFormat } from "../../shared/types";

const formatCards: {
  key: ExportFormat;
  label: string;
  desc: string;
  icon: typeof FileText;
}[] = [
  { key: "docx", label: "Word", desc: ".docx 格式文档", icon: FileText },
  { key: "pdf", label: "PDF", desc: "便携文档格式", icon: FileDown },
  { key: "latex", label: "LaTeX", desc: "学术排版源码", icon: Code },
  { key: "typst", label: "Typst", desc: "新一代排版系统", icon: TypstIcon },
];

const citationTabs: { key: CitationFormat; label: string }[] = [
  { key: "bibtex", label: "BibTeX" },
  { key: "gbt", label: "GB/T" },
  { key: "apa", label: "APA" },
  { key: "ieee", label: "IEEE" },
];

export default function Export() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, citationFormat, setCitationFormat, generatedSections } =
    useAppStore();

  const project = projects.find((p) => p.id === id);

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("docx");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async () => {
    if (!id) return;
    setIsExporting(true);
    setExportSuccess(false);
    try {
      const result = await exportDocument(id, selectedFormat, citationFormat, includeCharts, includeToc);
      if (result.jobId) {
        await downloadFile(result.jobId);
      }
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const sorted = [...generatedSections].sort((a, b) => a.order - b.order);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-navy-400 font-serif text-lg">项目未找到</p>
          <button
            className="btn-secondary mt-4 text-sm"
            onClick={() => navigate("/")}
          >
            返回工作台
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="section-title mb-2">导出文档</h1>
        <p className="text-navy-400 text-sm mb-4">
          项目：{project.title}
        </p>
        <div className="mb-8 px-4 py-3 bg-cyan-50 border border-cyan-200 rounded-lg flex items-center gap-2">
          <Info size={16} className="text-cyan-500 shrink-0" />
          <p className="text-sm text-cyan-700">
            请及时导出论文，建议以 Word 格式导出。
          </p>
        </div>

        <div className="mb-8">
          <h3 className="font-medium text-navy-700 mb-3">选择格式</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {formatCards.map((fmt) => {
              const Icon = fmt.icon;
              const active = selectedFormat === fmt.key;
              return (
                <motion.button
                  key={fmt.key}
                  onClick={() => setSelectedFormat(fmt.key)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    active
                      ? "border-cyan bg-cyan/5 glow-sm"
                      : "border-navy-100 bg-ivory hover:border-navy-200"
                  }`}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon
                    size={28}
                    className={`mx-auto mb-2 ${
                      active ? "text-cyan" : "text-navy-300"
                    }`}
                  />
                  <p
                    className={`font-medium text-sm ${
                      active ? "text-cyan" : "text-navy-600"
                    }`}
                  >
                    {fmt.label}
                  </p>
                  <p className="text-[11px] text-navy-400 mt-0.5">{fmt.desc}</p>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-medium text-navy-700 mb-3">引用格式</h3>
          <div className="flex gap-2">
            {citationTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setCitationFormat(tab.key)}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  citationFormat === tab.key
                    ? "border-cyan bg-cyan/10 text-cyan"
                    : "border-navy-100 text-navy-400 hover:border-navy-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-medium text-navy-700 mb-3">选项</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  includeCharts ? "bg-cyan" : "bg-navy-200"
                }`}
                onClick={() => setIncludeCharts(!includeCharts)}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    includeCharts ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-sm text-navy-600">包含图表</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  includeToc ? "bg-cyan" : "bg-navy-200"
                }`}
                onClick={() => setIncludeToc(!includeToc)}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    includeToc ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-sm text-navy-600">包含目录</span>
            </label>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-medium text-navy-700 mb-3">文档预览</h3>
          <div className="bg-white border border-navy-100 rounded-xl shadow-inner p-8 max-w-md mx-auto aspect-[210/297] overflow-y-auto scrollbar-thin">
            <div className="text-center mb-6">
              <h2 className="font-serif text-lg font-bold text-navy-800">
                {project.title}
              </h2>
              <p className="text-xs text-navy-400 mt-1">
                {new Date().toLocaleDateString("zh-CN")}
              </p>
            </div>
            {sorted.map((section) => (
              <div key={section.id} className="mb-4">
                <h3 className="font-serif text-sm font-semibold text-navy-700 mb-1">
                  {section.title}
                </h3>
                <p className="text-[11px] text-navy-500 leading-relaxed line-clamp-4">
                  {section.content}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            className="btn-primary flex items-center gap-2 text-base"
            onClick={handleExport}
            disabled={isExporting || generatedSections.length === 0}
          >
            {isExporting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                导出中...
              </>
            ) : exportSuccess ? (
              <>
                <CheckCircle size={18} />
                导出成功
              </>
            ) : (
              <>
                <Download size={18} />
                导出文档
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

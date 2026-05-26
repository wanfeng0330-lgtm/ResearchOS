import { motion } from "framer-motion";
import { KeyRound, Search, FileText, FlaskConical, PenTool, Quote, ShieldCheck, ScanSearch, BarChart3, Type, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { AgentStage } from "../../shared/types";

const stages: { key: AgentStage; label: string; icon: typeof Search }[] = [
  { key: "keyword_extracting", label: "关键词提取", icon: KeyRound },
  { key: "searching", label: "文献检索", icon: Search },
  { key: "parsing", label: "解析文献", icon: FileText },
  { key: "extracting", label: "观点提取", icon: FlaskConical },
  { key: "writing", label: "撰写论文", icon: PenTool },
  { key: "citing", label: "引用格式化", icon: Quote },
  { key: "integrity_reviewing", label: "完整性审核", icon: ShieldCheck },
  { key: "aigc_detecting", label: "AIGC降痕", icon: ScanSearch },
  { key: "charting", label: "图表生成", icon: BarChart3 },
  { key: "formatting", label: "排版整理", icon: Type },
];

interface AgentWorkflowProps {
  currentStage: AgentStage | null;
  progress: number;
  message?: string;
  hasError?: boolean;
}

export default function AgentWorkflow({ currentStage, progress, message, hasError }: AgentWorkflowProps) {
  const currentIndex = currentStage
    ? stages.findIndex((stage) => stage.key === currentStage)
    : -1;

  const isErrorMessage = message && (message.includes("失败") || message.includes("超时") || message.includes("错误") || message.includes("Error"));

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between max-w-4xl mx-auto px-4">
        {stages.map((stage, index) => {
          const isActive = stage.key === currentStage;
          const isCompleted = currentIndex > index;
          const isFailed = isActive && hasError;
          const Icon = stage.icon;

          return (
            <div key={stage.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                    isFailed
                      ? "border-red-400 bg-red-50"
                      : isActive
                      ? "border-cyan bg-cyan/10 animate-pulse-glow"
                      : isCompleted
                      ? "border-cyan bg-cyan/20"
                      : "border-navy-200 bg-ivory"
                  }`}
                  animate={isActive && !isFailed ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  {isFailed ? (
                    <AlertCircle size={16} className="text-red-400" />
                  ) : isCompleted ? (
                    <CheckCircle2 size={16} className="text-cyan-600" />
                  ) : isActive ? (
                    <Icon size={16} className="text-cyan" />
                  ) : (
                    <Icon size={16} className="text-navy-300" />
                  )}
                </motion.div>
                <span
                  className={`text-[11px] font-medium ${
                    isFailed
                      ? "text-red-400"
                      : isActive
                      ? "text-cyan"
                      : isCompleted
                      ? "text-cyan-600"
                      : "text-navy-300"
                  }`}
                >
                  {stage.label}
                </span>
              </div>

              {index < stages.length - 1 && (
                <div className="w-4 h-0.5 mx-0.5 relative overflow-hidden rounded bg-navy-100">
                  <motion.div
                    className={`absolute inset-y-0 left-0 ${
                      isFailed ? "bg-red-300" : "bg-gradient-to-r from-cyan to-cyan-400"
                    }`}
                    initial={{ width: "0%" }}
                    animate={{
                      width: isCompleted ? "100%" : isActive ? `${progress}%` : "0%",
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {currentStage && (
        <motion.div
          className="text-center mt-3"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-center gap-2">
            {hasError ? (
              <AlertCircle size={14} className="text-red-400" />
            ) : (
              <Loader2 size={14} className="text-cyan animate-spin" />
            )}
            <p className={`text-sm font-medium ${hasError ? "text-red-500" : "text-navy-500"}`}>
              {stages.find((stage) => stage.key === currentStage)?.label} · {Math.round(progress)}%
            </p>
          </div>

          <div className="mt-2 mx-auto max-w-md">
            <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  hasError
                    ? "bg-red-400"
                    : "bg-gradient-to-r from-cyan-500 to-cyan-400"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>

          {message && (
            <motion.p
              className={`text-xs mt-2 ${
                isErrorMessage || hasError
                  ? "text-red-400 font-medium"
                  : "text-navy-300"
              }`}
              key={message}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {message}
            </motion.p>
          )}
        </motion.div>
      )}
    </div>
  );
}

import { motion } from "framer-motion";
import { KeyRound, Search, FlaskConical, ListTree, PenTool, CheckCircle2, Loader2, Circle } from "lucide-react";
import type { WizardStep, WizardStepStatus } from "../../shared/types";

const steps: { step: WizardStep; label: string; icon: typeof KeyRound }[] = [
  { step: 1, label: "关键词提取", icon: KeyRound },
  { step: 2, label: "文献检索", icon: Search },
  { step: 3, label: "观点提取", icon: FlaskConical },
  { step: 4, label: "大纲生成", icon: ListTree },
  { step: 5, label: "论文撰写", icon: PenTool },
  { step: 6, label: "完成", icon: CheckCircle2 },
];

interface StepSidebarProps {
  currentStep: WizardStep;
  stepStatuses: Record<WizardStep, WizardStepStatus>;
  onStepClick: (step: WizardStep) => void;
}

export default function StepSidebar({ currentStep, stepStatuses, onStepClick }: StepSidebarProps) {
  return (
    <div className="w-56 border-r border-navy-100 bg-warmgray/30 flex flex-col py-6 px-3">
      <h3 className="text-xs font-semibold text-navy-400 uppercase tracking-wider mb-4 px-2">
        撰写流程
      </h3>
      <div className="space-y-1">
        {steps.map(({ step, label, icon: Icon }) => {
          const status = stepStatuses[step];
          const isActive = step === currentStep;
          const isCompleted = status === "confirmed";
          const isClickable = isCompleted || step <= currentStep;

          return (
            <motion.button
              key={step}
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                isActive
                  ? "bg-cyan/10 text-cyan border border-cyan/20"
                  : isCompleted
                  ? "text-navy-600 hover:bg-navy-50 border border-transparent"
                  : isClickable
                  ? "text-navy-500 hover:bg-navy-50 border border-transparent"
                  : "text-navy-300 border border-transparent cursor-not-allowed"
              }`}
              whileHover={isClickable ? { x: 2 } : {}}
              whileTap={isClickable ? { scale: 0.98 } : {}}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isActive
                    ? "bg-cyan/20 border-2 border-cyan"
                    : isCompleted
                    ? "bg-cyan/10 border-2 border-cyan/40"
                    : "bg-navy-50 border-2 border-navy-200"
                }`}
              >
                {status === "running" ? (
                  <Loader2 size={14} className="text-cyan animate-spin" />
                ) : isCompleted ? (
                  <CheckCircle2 size={14} className="text-cyan-600" />
                ) : isActive ? (
                  <Icon size={14} className="text-cyan" />
                ) : (
                  <Circle size={14} className="text-navy-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isActive ? "text-cyan" : ""}`}>
                  {label}
                </p>
              </div>
              <span className="text-[10px] text-navy-300">{step}/6</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

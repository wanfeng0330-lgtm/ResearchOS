import { useState } from "react";
import { PAPER_TYPE_LABELS, PAPER_TYPE_DESCRIPTIONS } from "../../shared/types";
import type { PaperType } from "../../shared/types";

interface PaperTypeSelectProps {
  value: PaperType;
  onChange: (value: PaperType) => void;
}

const TYPES: PaperType[] = ["graduation", "journal", "literature_review", "term_paper", "proposal"];

export default function PaperTypeSelect({ value, onChange }: PaperTypeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-navy-600 mb-1.5">论文类型</label>
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-navy-200 bg-white text-sm text-navy-700 hover:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex items-center gap-2">
          <span className="font-medium">{PAPER_TYPE_LABELS[value]}</span>
          <span className="text-navy-400 text-xs">· {PAPER_TYPE_DESCRIPTIONS[value].slice(0, 20)}...</span>
        </span>
        <svg className={`w-4 h-4 text-navy-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-lg border border-navy-200 shadow-lg overflow-hidden">
          {TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`w-full text-left px-4 py-3 hover:bg-cyan/5 transition-colors ${
                value === type ? "bg-cyan/10 border-l-2 border-cyan" : "border-l-2 border-transparent"
              }`}
              onClick={() => {
                onChange(type);
                setIsOpen(false);
              }}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${value === type ? "text-cyan" : "text-navy-700"}`}>
                  {PAPER_TYPE_LABELS[type]}
                </span>
                {value === type && (
                  <svg className="w-4 h-4 text-cyan" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-xs text-navy-400 mt-0.5">{PAPER_TYPE_DESCRIPTIONS[type]}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

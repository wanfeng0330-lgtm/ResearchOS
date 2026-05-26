import { useState, useEffect } from "react";
import { AlertCircle, Info } from "lucide-react";

const MIN_WORDS = 5000;
const MAX_WORDS = 50000;
const DEFAULT_WORDS = 5000;
const UPPER_RATIO = 1.3;

interface WordCountInputProps {
  value: number;
  onChange: (value: number) => void;
}

export default function WordCountInput({ value, onChange }: WordCountInputProps) {
  const [inputText, setInputText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [usedDefault, setUsedDefault] = useState(false);

  useEffect(() => {
    setInputText(String(value));
  }, [value]);

  const upperLimit = Math.round(value * UPPER_RATIO);

  function validate(text: string): { valid: boolean; num: number; error: string | null } {
    if (!text || text.trim() === "") {
      return { valid: true, num: DEFAULT_WORDS, error: null };
    }

    const num = Number(text);

    if (!Number.isInteger(num)) {
      return { valid: false, num: 0, error: "请输入正整数" };
    }

    if (num < MIN_WORDS) {
      return { valid: false, num: 0, error: `最低字数不得小于 ${MIN_WORDS} 字` };
    }

    if (num > MAX_WORDS) {
      return { valid: false, num: 0, error: `最低字数不得超过 ${MAX_WORDS} 字` };
    }

    return { valid: true, num, error: null };
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setInputText(text);
    setUsedDefault(false);

    const result = validate(text);
    setError(result.error);

    if (result.valid) {
      if (!text || text.trim() === "") {
        setUsedDefault(true);
      }
      onChange(result.num);
    }
  }

  function handleBlur() {
    setIsFocused(false);

    if (!inputText || inputText.trim() === "") {
      setInputText(String(DEFAULT_WORDS));
      onChange(DEFAULT_WORDS);
      setUsedDefault(true);
      setError(null);
      return;
    }

    const result = validate(inputText);
    if (result.valid) {
      setInputText(String(result.num));
      onChange(result.num);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-navy-700 mb-1.5">
          最低字数要求：
        </label>
        <div className="relative">
          <input
            type="number"
            value={inputText}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            min={MIN_WORDS}
            max={MAX_WORDS}
            step={100}
            className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors outline-none ${
              error
                ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                : "border-navy-200 bg-white focus:border-cyan focus:ring-2 focus:ring-cyan/20"
            }`}
            placeholder={`默认 ${DEFAULT_WORDS} 字`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-navy-300">
            字
          </span>
        </div>
      </div>

      {isFocused && !error && (
        <div className="flex items-start gap-1.5 text-xs text-navy-400">
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>输入范围 {MIN_WORDS}-{MAX_WORDS} 字，留空则默认 {DEFAULT_WORDS} 字</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle size={12} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {usedDefault && !error && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
          <Info size={12} className="shrink-0" />
          <span>未输入字数，已使用默认值 {DEFAULT_WORDS} 字</span>
        </div>
      )}

      {!error && (
        <div className="px-3 py-2 bg-navy-50 rounded-lg border border-navy-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-navy-500">字数上限：</span>
            <span className="font-medium text-navy-700">
              {upperLimit.toLocaleString()} 字
              <span className="text-navy-400 font-normal ml-1">（最低字数 +30%）</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-navy-500">生成范围：</span>
            <span className="text-navy-600">
              {value.toLocaleString()} ~ {upperLimit.toLocaleString()} 字
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

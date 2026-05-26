import { useState } from "react";
import { X, Pencil } from "lucide-react";

interface KeywordTagProps {
  text: string;
  color?: "blue" | "gray" | "green";
  onRemove?: () => void;
  onEdit?: (newText: string) => void;
}

const colorClasses = {
  blue: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  gray: "bg-navy-50 text-navy-600 border-navy-200 hover:bg-navy-100",
  green: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
};

export default function KeywordTag({ text, color = "blue", onRemove, onEdit }: KeywordTagProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  const handleDoubleClick = () => {
    if (onEdit) {
      setEditing(true);
      setEditText(text);
    }
  };

  const handleBlur = () => {
    setEditing(false);
    if (editText.trim() && editText.trim() !== text) {
      onEdit?.(editText.trim());
    } else {
      setEditText(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleBlur();
    if (e.key === "Escape") {
      setEditText(text);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        className="px-2 py-0.5 text-sm border border-cyan rounded bg-white outline-none focus:ring-1 focus:ring-cyan/30 w-24"
      />
    );
  }

  return (
    <span
      onDoubleClick={handleDoubleClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors group ${colorClasses[color]}`}
    >
      {text}
      {onEdit && (
        <button onClick={handleDoubleClick} className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil size={10} />
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-red-500 transition-colors">
          <X size={12} />
        </button>
      )}
    </span>
  );
}

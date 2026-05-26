import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";

interface ViewpointCardProps {
  text: string;
  index: number;
  selected: boolean;
  onToggleSelect: (index: number) => void;
  onEdit: (index: number, newText: string) => void;
  onDelete: (index: number) => void;
}

export default function ViewpointCard({ text, index, selected, onToggleSelect, onEdit, onDelete }: ViewpointCardProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  const handleSave = () => {
    if (editText.trim()) {
      onEdit(index, editText.trim());
      setEditing(false);
    }
  };

  const handleCancel = () => {
    setEditText(text);
    setEditing(false);
  };

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        selected
          ? "border-cyan/30 bg-cyan/5"
          : "border-navy-100 bg-white hover:border-navy-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggleSelect(index)}
          className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
            selected
              ? "bg-cyan border-cyan text-white"
              : "border-navy-300 hover:border-cyan"
          }`}
        >
          {selected && <Check size={12} />}
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full text-sm text-navy-600 leading-relaxed p-2 border border-navy-200 rounded-md outline-none focus:ring-1 focus:ring-cyan/30 resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={handleSave} className="text-xs text-cyan hover:text-cyan-600 font-medium">保存</button>
                <button onClick={handleCancel} className="text-xs text-navy-400 hover:text-navy-600">取消</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-navy-600 leading-relaxed">{text}</p>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { setEditing(true); setEditText(text); }}
              className="p-1 text-navy-300 hover:text-cyan transition-colors"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => onDelete(index)}
              className="p-1 text-navy-300 hover:text-red-500 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

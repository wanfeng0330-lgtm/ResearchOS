import { motion } from "framer-motion";
import { FolderOpen, FileText } from "lucide-react";
import type { Workspace } from "../../shared/types";

interface WorkspaceCardProps {
  workspace: Workspace;
  projectCount: number;
  onClick: (id: string) => void;
}

export default function WorkspaceCard({ workspace, projectCount, onClick }: WorkspaceCardProps) {
  return (
    <motion.div
      className="card p-5 cursor-pointer"
      whileHover={{ y: -3 }}
      onClick={() => onClick(workspace.id)}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
          <FolderOpen size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif font-semibold text-navy-700 line-clamp-1">
            {workspace.name}
          </h3>
          <p className="text-xs text-navy-400">
            {projectCount} 个项目
          </p>
        </div>
      </div>
      {workspace.description && (
        <p className="text-sm text-navy-400 line-clamp-2 mb-3">
          {workspace.description}
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-navy-300">
        <span className="flex items-center gap-1">
          <FileText size={12} />
          {new Date(workspace.updatedAt).toLocaleDateString("zh-CN")}
        </span>
      </div>
    </motion.div>
  );
}

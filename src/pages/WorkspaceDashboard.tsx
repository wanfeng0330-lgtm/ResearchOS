import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FolderOpen, X, Sparkles } from "lucide-react";
import useAppStore from "@/store/useAppStore";
import WorkspaceCard from "@/components/WorkspaceCard";
import ParticleBackground from "@/components/ParticleBackground";
import { fetchWorkspaces, createWorkspace, fetchWorkspaceProjects } from "@/utils/api";

export default function WorkspaceDashboard() {
  const navigate = useNavigate();
  const { workspaces, setWorkspaces, addWorkspace } = useAppStore();
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDesc, setWorkspaceDesc] = useState("");
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchWorkspaces()
      .then((ws) => {
        if (ws && ws.length > 0) {
          setWorkspaces(ws);
          ws.forEach(async (w) => {
            try {
              const projects = await fetchWorkspaceProjects(w.id);
              setProjectCounts((prev) => ({ ...prev, [w.id]: projects.length }));
            } catch {}
          });
        }
      })
      .catch(() => {});
  }, [setWorkspaces]);

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const ws = await createWorkspace(workspaceName.trim(), workspaceDesc.trim());
      addWorkspace(ws);
      setWorkspaceName("");
      setWorkspaceDesc("");
      setShowCreateWorkspace(false);
    } catch (error) {
      console.error("Failed to create workspace:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleWorkspaceClick = (workspaceId: string) => {
    navigate(`/workspace/${workspaceId}`);
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <section className="relative bg-navy-500 overflow-hidden">
        <ParticleBackground />
        <div className="relative z-10 flex flex-col items-center justify-center py-24 px-6 text-center">
          <motion.h1
            className="font-serif text-5xl md:text-6xl font-bold text-ivory mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Research<span className="text-cyan">OS</span>
          </motion.h1>
          <motion.p
            className="text-navy-200 text-lg max-w-xl mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            AI 科研工作流平台 — 文献管理、知识沉淀、智能写作
          </motion.p>
          <motion.button
            className="btn-primary flex items-center gap-2 text-base"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCreateWorkspace(true)}
          >
            <Sparkles size={18} />
            创建工作台
          </motion.button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">我的工作台</h2>
          <button
            className="btn-secondary text-sm flex items-center gap-1.5"
            onClick={() => setShowCreateWorkspace(true)}
          >
            <Plus size={16} />
            新建工作台
          </button>
        </div>

        {workspaces.length === 0 ? (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <FolderOpen size={48} className="mx-auto text-navy-200 mb-4" />
            <p className="text-navy-400 font-serif text-lg mb-2">
              还没有工作台
            </p>
            <p className="text-navy-300 text-sm">
              创建一个工作台来管理你的科研项目
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws, i) => (
              <motion.div
                key={ws.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
              >
                <WorkspaceCard
                  workspace={ws}
                  projectCount={projectCounts[ws.id] || 0}
                  onClick={handleWorkspaceClick}
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {showCreateWorkspace && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateWorkspace(false)}
          >
            <motion.div
              className="bg-ivory rounded-2xl p-6 w-full max-w-md shadow-xl border border-navy-100"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-serif text-xl font-semibold text-navy-700">
                  新建工作台
                </h3>
                <button
                  onClick={() => setShowCreateWorkspace(false)}
                  className="p-1 rounded-lg hover:bg-navy-50 transition-colors"
                >
                  <X size={18} className="text-navy-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-navy-600 mb-1.5">
                    工作台名称 *
                  </label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="例如：毕业论文研究"
                    className="input-field"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-600 mb-1.5">
                    描述
                  </label>
                  <textarea
                    value={workspaceDesc}
                    onChange={(e) => setWorkspaceDesc(e.target.value)}
                    placeholder="描述这个工作台的研究方向..."
                    className="input-field min-h-[80px] resize-y"
                    rows={3}
                  />
                </div>
                <button
                  onClick={handleCreateWorkspace}
                  disabled={!workspaceName.trim() || isCreating}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isCreating ? "创建中..." : "创建工作台"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

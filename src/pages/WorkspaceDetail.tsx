import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, ArrowLeft } from "lucide-react";
import useAppStore from "@/store/useAppStore";
import { fetchWorkspace, fetchWorkspaceProjects, createProjectInWorkspace } from "@/utils/api";
import type { Workspace, Project } from "../../shared/types";

const statusLabels: Record<Project["status"], string> = {
  draft: "草稿",
  searching: "检索中",
  parsing: "解析中",
  generating: "生成中",
  completed: "已完成",
};

const statusBadge: Record<Project["status"], string> = {
  draft: "badge-draft",
  searching: "badge-active",
  parsing: "badge-active",
  generating: "badge-active",
  completed: "badge-completed",
};

export default function WorkspaceDetail() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useAppStore();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    fetchWorkspace(workspaceId)
      .then(setWorkspace)
      .catch(() => {});
    fetchWorkspaceProjects(workspaceId)
      .then(setProjects)
      .catch(() => {});
  }, [workspaceId]);

  const handleCreateProject = async () => {
    if (!topic.trim() || !workspaceId || isCreating) return;
    setIsCreating(true);
    try {
      const project = await createProjectInWorkspace(
        workspaceId,
        topic.trim(),
        undefined,
        description.trim(),
        language,
      );
      setProjects((prev) => [...prev, project]);
      setTopic("");
      setDescription("");
      setShowCreateProject(false);
      navigate(`/project/${project.id}`);
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-navy-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <button
          className="flex items-center gap-1.5 text-navy-400 hover:text-navy-600 mb-6 transition-colors"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={16} />
          返回工作台列表
        </button>

        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-navy-700 mb-2">
            {workspace.name}
          </h1>
          {workspace.description && (
            <p className="text-navy-400">{workspace.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">科研项目</h2>
          <button
            className="btn-secondary text-sm flex items-center gap-1.5"
            onClick={() => setShowCreateProject(true)}
          >
            <Plus size={16} />
            新建项目
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={48} className="mx-auto text-navy-200 mb-4" />
            <p className="text-navy-400 font-serif text-lg mb-2">
              还没有项目
            </p>
            <p className="text-navy-300 text-sm">
              在这个工作台中创建你的第一个研究项目
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                className="card p-5 cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                whileHover={{ y: -3 }}
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <h3 className="font-serif font-semibold text-navy-700 mb-1 line-clamp-1">
                  {project.title}
                </h3>
                <p className="text-sm text-navy-400 mb-3 line-clamp-2">
                  {project.description || project.topic}
                </p>
                <div className="flex items-center justify-between">
                  <span className={statusBadge[project.status]}>
                    {statusLabels[project.status]}
                  </span>
                  <span className="text-xs text-navy-300">
                    {new Date(project.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {showCreateProject && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowCreateProject(false)}
        >
          <motion.div
            className="bg-ivory rounded-2xl p-6 w-full max-w-md shadow-xl border border-navy-100"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl font-semibold text-navy-700 mb-5">
              新建研究项目
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy-600 mb-1.5">
                  主题/标题 *
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例如：大语言模型在科学发现中的应用"
                  className="input-field"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-600 mb-1.5">
                  详细信息/研究方向
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="请描述您的研究方向..."
                  className="input-field min-h-[80px] resize-y"
                  rows={3}
                />
              </div>
              <button
                onClick={handleCreateProject}
                disabled={!topic.trim() || isCreating}
                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCreating ? "创建中..." : "创建项目"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

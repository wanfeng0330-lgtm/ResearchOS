import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FileText, X, Sparkles, BookOpen, PenTool, ShieldCheck, BarChart3, ScanSearch, Languages } from "lucide-react";
import useAppStore from "@/store/useAppStore";
import ParticleBackground from "@/components/ParticleBackground";
import { createProject, fetchProjects } from "@/utils/api";
import type { Project } from "../../shared/types";

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

export default function Home() {
  const navigate = useNavigate();
  const { projects, addProject, setProjects, language } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionManuallyEdited, setDescriptionManuallyEdited] = useState(false);

  const handleTopicChange = (value: string) => {
    setTopic(value);
    if (!descriptionManuallyEdited) {
      setDescription(value);
    }
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setDescriptionManuallyEdited(true);
  };

  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchProjects()
      .then((serverProjects) => {
        if (serverProjects && serverProjects.length > 0) {
          setProjects(serverProjects);
        }
      })
      .catch(() => {});
  }, [setProjects]);

  const handleCreate = async () => {
    if (!topic.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const serverProject = await createProject(topic.trim(), undefined, description.trim(), language);
      addProject(serverProject);
      setTopic("");
      setDescription("");
      setDescriptionManuallyEdited(false);
      setShowModal(false);
      navigate(`/project/${serverProject.id}`);
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setTopic("");
    setDescription("");
    setDescriptionManuallyEdited(false);
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
            AI 驱动的自动化科研写作平台，从文献检索到综述生成，一站式完成
          </motion.p>
          <motion.button
            className="btn-primary flex items-center gap-2 text-base"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowModal(true)}
          >
            <Sparkles size={18} />
            开始新项目
          </motion.button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="section-title text-center mb-8">核心功能</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: BookOpen,
              title: "智能文献检索",
              desc: "自动提取关键词，跨数据库检索学术文献，智能筛选高相关性论文",
              color: "from-blue-500 to-blue-400",
            },
            {
              icon: PenTool,
              title: "AI论文撰写",
              desc: "基于文献证据自动生成学术论文，严格遵循学术写作规范与引用标准",
              color: "from-cyan-500 to-cyan-400",
            },
            {
              icon: ShieldCheck,
              title: "完整性审核",
              desc: "自动校验引用完整性、论点支撑度与学术逻辑，确保论文严谨可靠",
              color: "from-green-500 to-green-400",
            },
            {
              icon: ScanSearch,
              title: "AIGC降痕优化",
              desc: "三轮迭代检测AI生成痕迹，智能改写降低AIGC率，使论文表达更自然",
              color: "from-purple-500 to-purple-400",
            },
            {
              icon: BarChart3,
              title: "可视化图表",
              desc: "自动生成文献趋势、关键词频率等学术图表，提升论文可视化表现力",
              color: "from-amber-500 to-amber-400",
            },
            {
              icon: Languages,
              title: "多格式导出",
              desc: "支持Word、PDF、LaTeX等多种格式导出，自动生成目录与参考文献",
              color: "from-rose-500 to-rose-400",
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              className="card-static p-5 group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
              whileHover={{ y: -4, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon size={20} className="text-white" />
              </div>
              <h3 className="font-serif font-semibold text-navy-700 mb-1.5">{feature.title}</h3>
              <p className="text-sm text-navy-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">我的项目</h2>
          <button
            className="btn-secondary text-sm flex items-center gap-1.5"
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} />
            新建项目
          </button>
        </div>

        {projects.length === 0 ? (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <FileText size={48} className="mx-auto text-navy-200 mb-4" />
            <p className="text-navy-400 font-serif text-lg mb-2">
              还没有项目
            </p>
            <p className="text-navy-300 text-sm">
              点击上方按钮创建你的第一个研究项目
            </p>
          </motion.div>
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
      </section>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
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
                  新建研究项目
                </h3>
                <button
                  onClick={closeModal}
                  className="p-1 rounded-lg hover:bg-navy-50 transition-colors"
                >
                  <X size={18} className="text-navy-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-navy-600 mb-1.5">
                    主题/标题 *
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    placeholder="例如：大语言模型在科学发现中的应用"
                    className="input-field"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-600 mb-1.5">
                    详细信息/研究方向
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    placeholder="请描述您的研究方向、关注的具体问题和研究背景..."
                    className="input-field min-h-[80px] resize-y"
                    rows={3}
                  />
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!topic.trim() || isCreating}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isCreating ? "创建中..." : "创建项目"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

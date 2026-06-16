import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, BookOpen, PanelLeftClose, PanelLeft, LogIn, LogOut, User } from "lucide-react";
import useAppStore from "@/store/useAppStore";
import { isLoggedIn, getCurrentUser, logout } from "@/utils/api";

const navItems = [
  { to: "/", label: "工作台", icon: LayoutDashboard },
  { to: "/library", label: "文献库", icon: BookOpen },
];

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string | null>(null);
  const loggedIn = isLoggedIn();

  useEffect(() => {
    if (loggedIn) {
      getCurrentUser()
        .then((user) => setUserName(user.name || user.email.split("@")[0]))
        .catch(() => setUserName(null));
    }
  }, [loggedIn]);

  const handleLogout = async () => {
    try { await logout(); } catch {}
    setUserName(null);
    navigate("/");
  };

  return (
    <aside
      className={`${
        sidebarOpen ? "w-60" : "w-16"
      } h-screen bg-navy-500 flex flex-col transition-all duration-300 shrink-0`}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b border-navy-400/30">
        {sidebarOpen && (
          <span className="font-serif text-xl font-bold text-ivory">
            Research<span className="text-cyan">OS</span>
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-navy-300 hover:bg-navy-700/50 hover:text-ivory transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              isActive ? "sidebar-link-active" : "sidebar-link"
            }
          >
            <Icon size={20} />
            {sidebarOpen && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 pb-4 space-y-2">
        {sidebarOpen && loggedIn && userName ? (
          <div className="px-4 py-3 rounded-lg bg-navy-700/30">
            <div className="flex items-center gap-2 text-ivory text-sm mb-2">
              <User size={16} />
              <span className="truncate">{userName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-navy-300 hover:text-ivory text-xs transition-colors"
            >
              <LogOut size={14} />
              退出登录
            </button>
          </div>
        ) : sidebarOpen ? (
          <button
            onClick={() => navigate("/auth")}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-lg bg-navy-700/30 text-navy-300 hover:text-ivory text-sm transition-colors"
          >
            <LogIn size={16} />
            登录 / 注册
          </button>
        ) : null}

        {sidebarOpen && (
          <div className="px-4 py-3 rounded-lg bg-navy-700/30 text-navy-300 text-xs">
            AI 驱动的学术写作助手
          </div>
        )}
      </div>
    </aside>
  );
}

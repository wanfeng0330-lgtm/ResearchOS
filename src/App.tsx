import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import WorkspaceDashboard from "@/pages/WorkspaceDashboard";
import WorkspaceDetail from "@/pages/WorkspaceDetail";
import Project from "@/pages/Project";
import Library from "@/pages/Library";
import Export from "@/pages/Export";
import Auth from "@/pages/Auth";

export default function App() {
  return (
    <Router>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <Routes>
          <Route path="/" element={<WorkspaceDashboard />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/workspace/:id" element={<WorkspaceDetail />} />
          <Route path="/project/:id" element={<Project />} />
          <Route path="/library" element={<Library />} />
          <Route path="/export/:id" element={<Export />} />
        </Routes>
      </div>
    </Router>
  );
}

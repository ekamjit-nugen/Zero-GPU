import { Routes, Route, Navigate } from "react-router-dom";
import Navigation from "./components/Navigation";
import OptimizePage from "./pages/OptimizePage";
import RunPage from "./pages/RunPage";
import MonitorPage from "./pages/MonitorPage";
import ServerPage from "./pages/ServerPage";
import LibraryPage from "./pages/LibraryPage";
import SettingsPage from "./pages/SettingsPage";
import "./index.css";

export default function App() {
  return (
    <div className="flex flex-col h-screen bg-[#09090b]">
      <Navigation />
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/optimize" element={<OptimizePage />} />
          <Route path="/run" element={<RunPage />} />
          <Route path="/monitor" element={<MonitorPage />} />
          <Route path="/server" element={<ServerPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/optimize" replace />} />
        </Routes>
      </main>
    </div>
  );
}

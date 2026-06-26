import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AgentProvider } from "./components/agent/AgentProvider";
import MainEditorPage from "./pages/MainEditorPage";

/* ─── App root — MemoryRouter for desktop app ─── */
export default function App() {
  return (
    <AgentProvider>
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<MainEditorPage />} />
        </Routes>
      </MemoryRouter>
    </AgentProvider>
  );
}

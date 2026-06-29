// useKeyboardShortcuts.ts — 全局快捷键管理
import { useEffect } from "react";
import { usePanelStore } from "../store/panelStore";
import { useArticleStore } from "../store/articleStore";

export function useKeyboardShortcuts() {
  const sidebarOpen = usePanelStore((s) => s.sidebarOpen);
  const setSidebarOpen = usePanelStore((s) => s.setSidebarOpen);
  const setSettingsOpen = usePanelStore((s) => s.setSettingsOpen);
  const commandPaletteOpen = usePanelStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = usePanelStore((s) => s.setCommandPaletteOpen);
  const focusMode = usePanelStore((s) => s.focusMode);
  const setFocusMode = usePanelStore((s) => s.setFocusMode);
  const setThemePickerOpen = usePanelStore((s) => s.setThemePickerOpen);
  const setShowFinalPage = useArticleStore((s) => s.setShowFinalPage);
  const setActiveArticleId = useArticleStore((s) => s.setActiveArticleId);
  const setProjectPanelOpen = usePanelStore((s) => s.setProjectPanelOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "\\" && !e.shiftKey) {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
      if (ctrl && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      if (ctrl && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (ctrl && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setFocusMode(!focusMode);
      }
      if (e.key === "Escape") {
        setFocusMode(false);
        setThemePickerOpen(false);
        setSettingsOpen(false);
        setCommandPaletteOpen(false);
        setShowFinalPage(false);
        setActiveArticleId(null);
        setProjectPanelOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    sidebarOpen, setSidebarOpen, setSettingsOpen,
    commandPaletteOpen, setCommandPaletteOpen, focusMode, setFocusMode,
    setThemePickerOpen, setShowFinalPage, setActiveArticleId, setProjectPanelOpen,
  ]);
}

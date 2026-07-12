// useKeyboardShortcuts.ts — 全局快捷键管理
import { useEffect } from "react";
import { usePanelStore } from "../store/panelStore";
import { useArticleStore } from "../store/articleStore";
import { useAgent } from "../lib/ai/agent";

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
  const setMainRoute = usePanelStore((s) => s.setMainRoute);
  const { togglePanel, panelOpen, openCommandBar } = useAgent();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      // Sidebar: Ctrl+\ (no shift)
      if (ctrl && e.key === "\\" && !e.shiftKey) {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
      // AI Panel: Ctrl+Shift+\
      if (ctrl && e.shiftKey && e.key === "\\") {
        e.preventDefault();
        togglePanel();
      }
      // Settings: Ctrl+,
      if (ctrl && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
        setMainRoute('settings');
      }
      // Command Palette: Ctrl+Shift+P (Ctrl+K reserved for editor links)
      if (ctrl && e.shiftKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      // Focus mode: Ctrl+Shift+F
      if (ctrl && e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setFocusMode(!focusMode);
      }
      // AI Command Bar: Ctrl+Shift+K
      if (ctrl && e.shiftKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        openCommandBar();
      }
      // Escape: close all panels
      if (e.key === "Escape") {
        setFocusMode(false);
        setThemePickerOpen(false);
        setSettingsOpen(false);
        setCommandPaletteOpen(false);
        setShowFinalPage(false);
        setActiveArticleId(null);
        setMainRoute('editor');
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    sidebarOpen, setSidebarOpen, setSettingsOpen, togglePanel,
    commandPaletteOpen, setCommandPaletteOpen, focusMode, setFocusMode,
    setThemePickerOpen, setShowFinalPage, setActiveArticleId, setMainRoute,
    openCommandBar,
  ]);
}

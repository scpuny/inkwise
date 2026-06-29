// panelStore.ts — 面板开关 & 布局状态（基于 Zustand）
// 从 appStore.ts 拆分为领域 Store

import { create } from "zustand";
import type { SettingsTab } from "../components/settings";

/* ───────────── Panel Store ───────────── */

export interface PanelState {
  // Panels
  themePickerOpen: boolean;
  settingsOpen: boolean;
  settingsTab: SettingsTab;
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  focusMode: boolean;
  manageOpen: boolean;
  docPickerOpen: boolean;
  stylePanelOpen: boolean;
  seriesPlannerOpen: boolean;

  // Layout
  sidebarWidth: number;
  resizing: "sidebar" | null;

  // Project panel
  projectPanelOpen: boolean;
  projectPanelColId: string | null;
}

export interface PanelActions {
  setThemePickerOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsTab: (tab: SettingsTab) => void;
  setSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setFocusMode: (mode: boolean) => void;
  setManageOpen: (open: boolean) => void;
  setDocPickerOpen: (open: boolean) => void;
  setStylePanelOpen: (open: boolean) => void;
  setSeriesPlannerOpen: (open: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setResizing: (r: "sidebar" | null) => void;
  setProjectPanelOpen: (open: boolean) => void;
  setProjectPanelColId: (id: string | null) => void;
}

const DEFAULT_SETTINGS_TAB = "appearance";

export const usePanelStore = create<PanelState & PanelActions>()((set) => ({
  themePickerOpen: false,
  settingsOpen: false,
  settingsTab: DEFAULT_SETTINGS_TAB,
  sidebarOpen: true,
  commandPaletteOpen: false,
  focusMode: false,
  manageOpen: false,
  docPickerOpen: false,
  stylePanelOpen: false,
  seriesPlannerOpen: false,
  sidebarWidth: 264,
  resizing: null,
  projectPanelOpen: false,
  projectPanelColId: null,

  setThemePickerOpen: (themePickerOpen) => set({ themePickerOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSettingsTab: (settingsTab) => set({ settingsTab }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setFocusMode: (focusMode) => set({ focusMode }),
  setManageOpen: (manageOpen) => set({ manageOpen }),
  setDocPickerOpen: (docPickerOpen) => set({ docPickerOpen }),
  setStylePanelOpen: (stylePanelOpen) => set({ stylePanelOpen }),
  setSeriesPlannerOpen: (seriesPlannerOpen) => set({ seriesPlannerOpen }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setResizing: (resizing) => set({ resizing }),
  setProjectPanelOpen: (projectPanelOpen) => set({ projectPanelOpen }),
  setProjectPanelColId: (projectPanelColId) => set({ projectPanelColId }),
}));

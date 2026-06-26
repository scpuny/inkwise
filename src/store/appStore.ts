// appStore.ts — 应用级 UI 状态集中管理（基于 Zustand）
import type { SettingsTab } from "../components/settings";
// 替代 App.tsx 中大量分散的 useState：面板开关、文章/集合关联、侧边栏等

import { create } from "zustand";
import type { OutlineItem } from "../components/sidebar/OutlinePanel";
import type { SeriesPlan } from "../lib/storage/collections";

/* ───────────── App Store ───────────── */

export interface AppState {
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

  // Article / Collection
  activeArticleId: string | null;
  activeCollectionId: string | null;
  hasActiveArticle: boolean;
  outlineItems: OutlineItem[];
  activeOutlineId: string | null;

  // Series Planner
  seriesPlannerColId: string | null;
  seriesPlannerColTitle: string;
  seriesPlannerFolder: string;
  seriesPlannerExistingPlan: SeriesPlan | null;
  seriesRefreshKey: number;

  // Article lifecycle
  saveState: "idle" | "saving" | "saved" | "error";
  articlePhase: string | undefined;
  showFinalPage: boolean;
}

export interface AppActions {
  // Panel toggles
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

  // Layout
  setSidebarWidth: (w: number) => void;
  setResizing: (r: "sidebar" | null) => void;

  // Article / Collection
  setActiveArticleId: (id: string | null) => void;
  setActiveCollectionId: (id: string | null) => void;
  setHasActiveArticle: (has: boolean) => void;
  setOutlineItems: (items: OutlineItem[]) => void;
  setActiveOutlineId: (id: string | null) => void;

  // Series Planner
  setSeriesPlannerColId: (id: string | null) => void;
  setSeriesPlannerColTitle: (title: string) => void;
  setSeriesPlannerFolder: (folder: string) => void;
  setSeriesPlannerExistingPlan: (plan: SeriesPlan | null) => void;
  incSeriesRefreshKey: () => void;

  // Article lifecycle
  setSaveState: (state: "idle" | "saving" | "saved" | "error") => void;
  setArticlePhase: (phase: string | undefined) => void;
  setShowFinalPage: (show: boolean) => void;
}

const DEFAULT_SETTINGS_TAB = "appearance";

export const useAppStore = create<AppState & AppActions>()((set) => ({
  // Panels
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

  // Layout
  sidebarWidth: 264,
  resizing: null,

  // Article / Collection
  activeArticleId: null,
  activeCollectionId: null,
  hasActiveArticle: false,
  outlineItems: [],
  activeOutlineId: null,

  // Series Planner
  seriesPlannerColId: null,
  seriesPlannerColTitle: "",
  seriesPlannerFolder: "",
  seriesPlannerExistingPlan: null,
  seriesRefreshKey: 0,

  // Article lifecycle
  saveState: "idle",
  articlePhase: undefined,
  showFinalPage: false,

  // ── Panel actions ──
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

  // ── Layout actions ──
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setResizing: (resizing) => set({ resizing }),

  // ── Article / Collection actions ──
  setActiveArticleId: (activeArticleId) => set({ activeArticleId }),
  setActiveCollectionId: (activeCollectionId) => set({ activeCollectionId }),
  setHasActiveArticle: (hasActiveArticle) => set({ hasActiveArticle }),
  setOutlineItems: (outlineItems) => set({ outlineItems }),
  setActiveOutlineId: (activeOutlineId) => set({ activeOutlineId }),

  // ── Series Planner actions ──
  setSeriesPlannerColId: (seriesPlannerColId) => set({ seriesPlannerColId }),
  setSeriesPlannerColTitle: (seriesPlannerColTitle) => set({ seriesPlannerColTitle }),
  setSeriesPlannerFolder: (seriesPlannerFolder) => set({ seriesPlannerFolder }),
  setSeriesPlannerExistingPlan: (seriesPlannerExistingPlan) => set({ seriesPlannerExistingPlan }),
  incSeriesRefreshKey: () => set((s) => ({ seriesRefreshKey: s.seriesRefreshKey + 1 })),

  // ── Article lifecycle actions ──
  setSaveState: (saveState) => set({ saveState }),
  setArticlePhase: (articlePhase) => set({ articlePhase }),
  setShowFinalPage: (showFinalPage) => set({ showFinalPage }),
}));

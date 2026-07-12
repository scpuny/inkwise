// articleStore.ts — 当前文章/合集 & 系列规划器 & 文章生命周期（基于 Zustand）
// 从 appStore.ts 拆分为领域 Store

import { create } from "zustand";
import type { OutlineItem } from "../components/sidebar/OutlinePanel";
import type { SeriesPlan } from "../domain";

/* ───────────── Article Store ───────────── */

export interface ArticleState {
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

export interface ArticleActions {
  setActiveArticleId: (id: string | null) => void;
  setActiveCollectionId: (id: string | null) => void;
  setHasActiveArticle: (has: boolean) => void;
  setOutlineItems: (items: OutlineItem[]) => void;
  setActiveOutlineId: (id: string | null) => void;
  setSeriesPlannerColId: (id: string | null) => void;
  setSeriesPlannerColTitle: (title: string) => void;
  setSeriesPlannerFolder: (folder: string) => void;
  setSeriesPlannerExistingPlan: (plan: SeriesPlan | null) => void;
  incSeriesRefreshKey: () => void;
  setSaveState: (state: "idle" | "saving" | "saved" | "error") => void;
  setArticlePhase: (phase: string | undefined) => void;
  setShowFinalPage: (show: boolean) => void;
}

export const useArticleStore = create<ArticleState & ArticleActions>()((set) => ({
  activeArticleId: null,
  activeCollectionId: null,
  hasActiveArticle: false,
  outlineItems: [],
  activeOutlineId: null,
  seriesPlannerColId: null,
  seriesPlannerColTitle: "",
  seriesPlannerFolder: "",
  seriesPlannerExistingPlan: null,
  seriesRefreshKey: 0,
  saveState: "idle",
  articlePhase: undefined,
  showFinalPage: false,

  setActiveArticleId: (activeArticleId) => set({ activeArticleId }),
  setActiveCollectionId: (activeCollectionId) => set({ activeCollectionId }),
  setHasActiveArticle: (hasActiveArticle) => set({ hasActiveArticle }),
  setOutlineItems: (outlineItems) => set({ outlineItems }),
  setActiveOutlineId: (activeOutlineId) => set({ activeOutlineId }),
  setSeriesPlannerColId: (seriesPlannerColId) => set({ seriesPlannerColId }),
  setSeriesPlannerColTitle: (seriesPlannerColTitle) => set({ seriesPlannerColTitle }),
  setSeriesPlannerFolder: (seriesPlannerFolder) => set({ seriesPlannerFolder }),
  setSeriesPlannerExistingPlan: (seriesPlannerExistingPlan) => set({ seriesPlannerExistingPlan }),
  incSeriesRefreshKey: () => set((s) => ({ seriesRefreshKey: s.seriesRefreshKey + 1 })),
  setSaveState: (saveState) => set({ saveState }),
  setArticlePhase: (articlePhase) => set({ articlePhase }),
  setShowFinalPage: (showFinalPage) => set({ showFinalPage }),
}));

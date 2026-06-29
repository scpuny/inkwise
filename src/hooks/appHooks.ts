// appHooks.ts — App 层事件处理器和副作用逻辑
// 替代 App.tsx 中的 useEffect / useCallback 块

import { useCallback, useEffect, useRef, useState } from "react";
import { loadCollections, addCollection, addArticle, renameArticle, genId,
  linkCollectionFolder, unlinkCollectionFolder, saveSeriesPlan, loadSeriesPlan, loadAllSeriesPlans,
  type SeriesPlan,
} from "../lib/storage/collections";
import { saveBlueprint, loadBlueprint, createDefaultBlueprint, type ArticleBlueprint, type OutlineSection } from "../lib/ai/articleBlueprint";
import { saveArticleContent } from "../lib/storage/articles";
import { useAgent } from "../lib/ai/agent";
import { usePanelStore } from "../store/panelStore";
import { useArticleStore } from "../store/articleStore";
import { useEditorStore } from "../store/editorStore";
import { useThemeStore } from "../store/themeStore";
import type { Theme, ThemeStyle } from "../lib/theme/theme";
import type { TextSize } from "../lib/theme/textSize";
import type { FontFamily } from "../lib/theme/fontFamily";
import type { OutlineItem } from "../components/sidebar/OutlinePanel";
import type { DocPickerResult } from "../components/collections/DocPicker";
import { applyTheme, persistTheme } from "../lib/theme/theme";
import { applyTextSize } from "../lib/theme/textSize";
import { applyFontFamily } from "../lib/theme/fontFamily";
import { emit, on } from "../lib/events/eventBus";
import type { EventBusMap } from "../lib/events/events";

/**
 * 主题/样式处理器
 */
export function useThemeHandlers() {
  const themeMode = useThemeStore((s) => s.themeMode);
  const themeStyle = useThemeStore((s) => s.themeStyle);
  const setThemeStyle = useThemeStore((s) => s.setThemeStyle);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const setTextSize = useThemeStore((s) => s.setTextSize);
  const setFontFamily = useThemeStore((s) => s.setFontFamily);

  const handleSelectStyle = useCallback(
    (style: ThemeStyle) => {
      setThemeStyle(style);
      applyTheme(themeMode, style);
      persistTheme(themeMode, style);
      emit("article-theme-changed");
    },
    [themeMode, setThemeStyle],
  );

  const handleSelectMode = useCallback(
    (mode: Theme) => {
      setThemeMode(mode);
      applyTheme(mode, themeStyle);
      persistTheme(mode, themeStyle);
    },
    [themeStyle, setThemeMode],
  );

  const handleSelectTextSize = useCallback((size: TextSize) => {
    setTextSize(size);
    applyTextSize(size);
  }, [setTextSize]);

  const handleSelectFontFamily = useCallback((font: FontFamily) => {
    setFontFamily(font);
    applyFontFamily(font);
  }, [setFontFamily]);

  return { handleSelectStyle, handleSelectMode, handleSelectTextSize, handleSelectFontFamily };
}

/**
 * 文章生命周期处理器
 */
export function useArticleLifecycle() {
  const setActiveArticleId = useArticleStore((s) => s.setActiveArticleId);
  const setActiveCollectionId = useArticleStore((s) => s.setActiveCollectionId);
  const setHasActiveArticle = useArticleStore((s) => s.setHasActiveArticle);
  const setShowFinalPage = useArticleStore((s) => s.setShowFinalPage);
  const setSaveState = useArticleStore((s) => s.setSaveState);
  const setEditorStyleTemplate = useEditorStore((s) => s.setStyleTemplate);
  const setEditorLineHeight = useEditorStore((s) => s.setLineHeight);
  const setEditorFontSize = useEditorStore((s) => s.setFontSize);
  const setEditorMaxWidth = useEditorStore((s) => s.setMaxWidth);
  const setEditorParagraphGap = useEditorStore((s) => s.setParagraphGap);
  const setEditorFontFamily = useEditorStore((s) => s.setFontFamily);
  const setCodeThemeId = useEditorStore((s) => s.setCodeThemeId);

  const applyHeadingNumbersRef = useRef<(() => void) | null>(null);
  const pendingSeriesArticleRef = useRef<{ collectionId: string; seriesId: string; articleId: string } | null>(null);
  const prevArticleRef = useRef<string | null>(null);
  const [styleReady, setStyleReadyState] = useState(0);

  return {
    applyHeadingNumbersRef,
    pendingSeriesArticleRef,
    prevArticleRef,
    styleReady,
    setStyleReady: setStyleReadyState,
    setActiveArticleId,
    setActiveCollectionId,
    setHasActiveArticle,
    setShowFinalPage,
    setSaveState,
    setEditorStyleTemplate,
    setEditorLineHeight,
    setEditorFontSize,
    setEditorMaxWidth,
    setEditorParagraphGap,
    setEditorFontFamily,
    setCodeThemeId,
  };
}

/* ───────────── Series Event Listeners ───────────── */

/**
 * plan-series: 从 CollectionTree 触发，打开系列规划器
 */
export function usePlanSeriesListener() {
  const setSeriesPlannerColId = useArticleStore((s) => s.setSeriesPlannerColId);
  const setSeriesPlannerColTitle = useArticleStore((s) => s.setSeriesPlannerColTitle);
  const setSeriesPlannerFolder = useArticleStore((s) => s.setSeriesPlannerFolder);
  const setSeriesPlannerOpen = usePanelStore((s) => s.setSeriesPlannerOpen);

  useEffect(() => {
    const handler = (detail?: EventBusMap["plan-series"]) => {
      const { collectionId } = detail || {};
      if (!collectionId) return;
      loadCollections()
        .then(cols => {
          const col = cols.find(c => c.id === collectionId);
          if (col) {
            setSeriesPlannerColId(col.id);
            setSeriesPlannerColTitle(col.title);
            setSeriesPlannerFolder(col.linkedFolder || "");
            setSeriesPlannerOpen(true);
          } else {
            console.warn("plan-series: 未找到合集", collectionId);
          }
        })
        .catch(err => console.warn("plan-series: 加载合集失败", err));
    };
    return on("plan-series", handler);
  }, []);
}

/**
 * edit-series-plan: 从 SeriesOverview "编辑规划" 触发
 */
export function useEditSeriesPlanListener() {
  const setSeriesPlannerColId = useArticleStore((s) => s.setSeriesPlannerColId);
  const setSeriesPlannerColTitle = useArticleStore((s) => s.setSeriesPlannerColTitle);
  const setSeriesPlannerFolder = useArticleStore((s) => s.setSeriesPlannerFolder);
  const setSeriesPlannerExistingPlan = useArticleStore((s) => s.setSeriesPlannerExistingPlan);
  const setSeriesPlannerOpen = usePanelStore((s) => s.setSeriesPlannerOpen);

  useEffect(() => {
    const handler = async (detail?: EventBusMap["edit-series-plan"]) => {
      const { collectionId, seriesId } = detail || {};
      if (!collectionId) return;
      let plan: SeriesPlan | null = null;
      if (seriesId) {
        plan = await loadSeriesPlan(collectionId, seriesId);
      }
      const cols = await loadCollections();
      const col = cols.find(c => c.id === collectionId);
      if (col) {
        setSeriesPlannerColId(col.id);
        setSeriesPlannerColTitle(col.title);
        setSeriesPlannerFolder(col.linkedFolder || "");
        setSeriesPlannerExistingPlan(plan || null);
        setSeriesPlannerOpen(true);
      }
    };
    return on("edit-series-plan", handler);
  }, []);
}

/**
 * plan-series-article: 从 SeriesOverview 触发，导航到规划模式
 */
export function usePlanSeriesArticleListener(pendingSeriesArticleRef: React.MutableRefObject<{ collectionId: string; seriesId: string; articleId: string } | null>) {
  const setActiveArticleId = useArticleStore((s) => s.setActiveArticleId);
  const setActiveCollectionId = useArticleStore((s) => s.setActiveCollectionId);
  const setHasActiveArticle = useArticleStore((s) => s.setHasActiveArticle);

  useEffect(() => {
    const handler = async (detail?: EventBusMap["plan-series-article"]) => {
      const { collectionId, seriesId: eventSeriesId, article } = detail || {};
      if (!collectionId || !article) return;
      try {
        pendingSeriesArticleRef.current = { collectionId, seriesId: eventSeriesId || '', articleId: article.id };
        setActiveArticleId(null);
        setActiveCollectionId(collectionId);
        setHasActiveArticle(false);

        const seriesPlan = await loadSeriesPlan(collectionId, eventSeriesId || "");
        const seriesTone = seriesPlan?.tone;
        const seriesAudience = seriesPlan?.targetAudience;
        const seriesSkillId = seriesPlan?.skillId;

        // 计算文章在系列中的序号，追加到标题
        const articleIndex = seriesPlan?.articles?.findIndex(a => a.id === article.id) ?? -1;
        const numberedTitle = articleIndex >= 0
          ? article.title.replace(/^\d+\.\s*/, '').trim()
          : article.title;
        const finalTitle = articleIndex >= 0
          ? articleIndex + 1 + '. ' + numberedTitle
          : article.title;

        setTimeout(() => {
          emit("auto-plan-article", {
            collectionId,
            title: finalTitle,
            description: article.description || "",
            tone: seriesTone,
            targetAudience: seriesAudience,
            skillId: seriesSkillId,
            targetWordCount: article.targetWordCount,
          });
        }, 100);

        emit("collections-changed");
      } catch (err) {
        console.warn("创建系列文章失败:", err);
      }
    };
    return on("plan-series-article", handler);
  }, []);
}

/**
 * series-article-review: 写作完成 → 更新状态为 reviewing
 */
export function useSeriesArticleReviewListener() {
  useEffect(() => {
    const handler = async (detail?: EventBusMap["series-article-review"]) => {
      const { articleId, collectionId, seriesId: eventSeriesId } = detail || {};
      if (!articleId || !collectionId) return;
      try {
        let seriesPlan: SeriesPlan | null = null;
        if (eventSeriesId) {
          seriesPlan = await loadSeriesPlan(collectionId, eventSeriesId);
        } else {
          const plans = await loadAllSeriesPlans(collectionId);
          for (const p of plans) {
            if (p.articles.some(a => a.id === articleId || a.articleId === articleId)) {
              seriesPlan = p;
              break;
            }
          }
        }
        if (!seriesPlan) return;
        const updated = seriesPlan.articles.map(a =>
          a.id === articleId ? { ...a, status: "reviewing" as const } : a
        );
        await saveSeriesPlan(collectionId, { ...seriesPlan, articles: updated });
        emit("collections-changed");
      } catch (err) {
        console.warn("series-article-review 更新状态失败:", err);
      }
    };
    return on("series-article-review", handler);
  }, []);
}

/**
 * 组合所有系列事件监听器
 */
export function useSeriesEventListeners(pendingSeriesArticleRef: React.MutableRefObject<{ collectionId: string; seriesId: string; articleId: string } | null>) {
  usePlanSeriesListener();
  useEditSeriesPlanListener();
  usePlanSeriesArticleListener(pendingSeriesArticleRef);
  useSeriesArticleReviewListener();
}

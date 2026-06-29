// useArticleLifecycle.ts — 文章 CRUD、阶段切换、规划完成（从 MainEditorPage 抽出）
import { useCallback, useEffect } from "react";
import { loadCollections, addCollection, addArticle,
  saveSeriesPlan, loadSeriesPlan } from "../lib/storage/collections";
import { saveBlueprint, loadBlueprint, createDefaultBlueprint, type OutlineSection } from "../lib/ai/articleBlueprint";
import { saveArticleContent } from "../lib/storage/articles";
import { useAgent } from "../lib/ai/agent";
import { loadArticleStyleConfig } from "../lib/editor/editorStyles";
import { ArticleContext } from "../lib/article/ArticleContext";
import { emit } from "../lib/events/eventBus";
import { useArticleStore } from "../store/articleStore";
import { useEditorStore } from "../store/editorStore";
import { usePanelStore } from "../store/panelStore";
import { useArticleLifecycle as useLifecycleRefs } from "./appHooks";

function makeBlueprint(title: string, plan: {
  title: string; description: string; outline: OutlineSection[];
  tags: string[]; tone: string; targetAudience: string; targetWordCount: number;
}) {
  const bp = createDefaultBlueprint(title);
  bp.workingTitle = plan.title || "无标题";
  bp.description = plan.description || "";
  bp.tone = plan.tone || undefined;
  bp.targetAudience = plan.targetAudience || undefined;
  bp.targetWordCount = plan.targetWordCount || undefined;
  bp.tags = plan.tags || [];
  bp.outline = plan.outline || [];
  bp.phase = "reviewing";
  return bp;
}

function makeSkeletonDoc(plan: { description: string; outline: OutlineSection[] }) {
  let doc = plan.description ? plan.description + "\n\n" : "";
  if (plan.outline) {
    for (const s of plan.outline) {
      doc += "#".repeat(Math.min(s.level + 1, 4)) + " " + s.title + "\n\n\n";
    }
  }
  return doc;
}

export function useArticleLifecycle() {
  const {
    applyHeadingNumbersRef, pendingSeriesArticleRef, prevArticleRef,
    styleReady, setStyleReady,
  } = useLifecycleRefs();

  const activeArticleId = useArticleStore((s) => s.activeArticleId);
  const setActiveArticleIdApp = useArticleStore((s) => s.setActiveArticleId);
  const setActiveCollectionId = useArticleStore((s) => s.setActiveCollectionId);
  const setHasActiveArticle = useArticleStore((s) => s.setHasActiveArticle);
  const setShowFinalPage = useArticleStore((s) => s.setShowFinalPage);
  const setArticlePhase = useArticleStore((s) => s.setArticlePhase);
  const setStylePanelOpen = usePanelStore((s) => s.setStylePanelOpen);
  const setDocPickerOpen = usePanelStore((s) => s.setDocPickerOpen);

  const editorStyleTemplate = useEditorStore((s) => s.styleTemplate);
  const editorLineHeight = useEditorStore((s) => s.lineHeight);
  const editorFontSize = useEditorStore((s) => s.fontSize);
  const editorMaxWidth = useEditorStore((s) => s.maxWidth);
  const editorParagraphGap = useEditorStore((s) => s.paragraphGap);
  const editorFontFamily = useEditorStore((s) => s.fontFamily);
  const codeThemeId = useEditorStore((s) => s.codeThemeId);
  const setEditorStyleTemplate = useEditorStore((s) => s.setStyleTemplate);
  const setEditorLineHeight = useEditorStore((s) => s.setLineHeight);
  const setEditorFontSize = useEditorStore((s) => s.setFontSize);
  const setEditorMaxWidth = useEditorStore((s) => s.setMaxWidth);
  const setEditorParagraphGap = useEditorStore((s) => s.setParagraphGap);
  const setEditorFontFamily = useEditorStore((s) => s.setFontFamily);
  const setCodeThemeId = useEditorStore((s) => s.setCodeThemeId);

  const { closePanel, setActiveArticleId: setCtxArticleId } = useAgent();

  // ── Wrapper: sync agent context + store ──
  const setActiveArticleId = useCallback((id: string | null) => {
    setActiveArticleIdApp(id);
    if (setCtxArticleId) setCtxArticleId(id);
  }, [setCtxArticleId, setActiveArticleIdApp]);

  // ── Style loading (on article switch) ──
  useEffect(() => {
    if (activeArticleId) {
      const config = loadArticleStyleConfig(activeArticleId);
      if (config) {
        setEditorStyleTemplate(config.editorStyleTemplateId);
        setEditorLineHeight(config.lineHeight);
        setEditorFontSize(config.editorFontSize);
        setEditorMaxWidth(config.editorMaxWidth);
        setEditorParagraphGap(config.editorParagraphGap);
        setEditorFontFamily(config.editorFontFamily);
        setCodeThemeId(config.codeThemeId);
      } else {
        setEditorStyleTemplate('default'); setEditorLineHeight(1.75);
        setEditorFontSize(15); setEditorMaxWidth(820);
        setEditorParagraphGap(1.25); setEditorFontFamily('');
        setCodeThemeId('atom-one-light');
      }
    }
    prevArticleRef.current = activeArticleId;
    setStyleReady(n => n + 1);
  }, [activeArticleId]);

  // ── Style persistence (on every change) ──
  useEffect(() => {
    if (!activeArticleId) return;
    localStorage.setItem('editor-style-template', editorStyleTemplate);
    localStorage.setItem('editor-line-height', String(editorLineHeight));
    localStorage.setItem('editor-font-size', String(editorFontSize));
    localStorage.setItem('editor-max-width', String(editorMaxWidth));
    localStorage.setItem('editor-paragraph-gap', String(editorParagraphGap));
    localStorage.setItem('editor-font-family', editorFontFamily);
    localStorage.setItem('code-theme-id', codeThemeId);
    new ArticleContext(activeArticleId).updateStyle({
      editorStyleTemplateId: editorStyleTemplate, lineHeight: editorLineHeight,
      editorFontSize, editorMaxWidth, editorParagraphGap,
      editorFontFamily, codeThemeId,
    });
  }, [activeArticleId, editorStyleTemplate, editorLineHeight, editorFontSize,
      editorMaxWidth, editorParagraphGap, editorFontFamily, codeThemeId]);

  // ── Callbacks ──
  const handleOpenArticle = useCallback((articleId: string, collectionId: string) => {
    setActiveArticleId(articleId);
    setActiveCollectionId(collectionId);
    setHasActiveArticle(true);
  }, [setActiveArticleId, setActiveCollectionId, setHasActiveArticle]);

  const handleBackToEdit = useCallback(() => {
    setShowFinalPage(false);
    closePanel();
    setStylePanelOpen(false);
  }, [setShowFinalPage, closePanel, setStylePanelOpen]);

  const handleEnterEditor = useCallback((articleId: string, collectionId: string) => {
    setActiveArticleId(articleId);
    setActiveCollectionId(collectionId);
    setHasActiveArticle(true);
    setShowFinalPage(false);
  }, [setActiveArticleId, setActiveCollectionId, setHasActiveArticle, setShowFinalPage]);

  const handleApplyHeadingNumbers = useCallback(() => {
    applyHeadingNumbersRef.current?.();
  }, [applyHeadingNumbersRef]);

  const handleDocPickerResult = useCallback(async (result: { action: string; articleId?: string; collectionId?: string }) => {
    if (result.action === "open" && result.articleId) {
      setActiveArticleId(result.articleId);
      setActiveCollectionId(result.collectionId || null);
      setHasActiveArticle(true);
    } else if (result.action === "create" && result.collectionId) {
      setActiveCollectionId(result.collectionId);
      const article = await addArticle(result.collectionId, "无标题");
      if (article) {
        setActiveArticleId(article.id);
        setHasActiveArticle(true);
      }
    } else if (result.action === "plan" && result.collectionId) {
      setActiveCollectionId(result.collectionId);
      setHasActiveArticle(false);
      setActiveArticleId(null);
    }
  }, [setActiveArticleId, setActiveCollectionId, setHasActiveArticle]);

  const syncSeriesArticleStatus = useCallback(async (articleId: string, newStatus: string) => {
    try {
      const { loadAllSeriesPlans, saveSeriesPlan, loadCollections } = await import("../lib/storage/collections");
      const cols = await loadCollections();
      for (const col of cols) {
        const plans = await loadAllSeriesPlans(col.id);
        for (const plan of plans) {
          const idx = plan.articles.findIndex(a => a.id === articleId || a.articleId === articleId);
          if (idx !== -1 && plan.articles[idx].status !== newStatus) {
            const updated = [...plan.articles];
            updated[idx] = { ...updated[idx], status: newStatus as any };
            await saveSeriesPlan(col.id, { ...plan, articles: updated });
            emit("collections-changed");
            return;
          }
        }
      }
    } catch {}
  }, []);

  const handlePhaseChange = useCallback((phase: string) => {
    setArticlePhase(phase);
    const aid = activeArticleId;
    if (phase === "complete") {
      closePanel(); setStylePanelOpen(false); setShowFinalPage(true);
      if (aid) syncSeriesArticleStatus(aid, "complete");
    } else if (phase === "writing" && aid) {
      setShowFinalPage(false);
      syncSeriesArticleStatus(aid, "writing");
    } else {
      setShowFinalPage(false);
    }
  }, [activeArticleId, closePanel, setArticlePhase, setShowFinalPage, setStylePanelOpen, syncSeriesArticleStatus]);

  const handlePlanComplete = useCallback(async (plan: {
    title: string; description: string; outline: OutlineSection[];
    tags: string[]; tone: string; targetAudience: string; targetWordCount: number;
  }, collectionId: string): Promise<{ articleId: string; collectionId: string } | null> => {
    let targetId = collectionId;
    const cols = await loadCollections();
    if (!targetId || !cols.some(c => c.id === targetId)) {
      targetId = cols.length > 0 ? cols[0].id : (await addCollection("默认合集")).id;
    }

    // Check series article for existing articleId
    let existingArticleId: string | null = null;
    const seriesRef = pendingSeriesArticleRef.current;
    if (seriesRef && seriesRef.collectionId === targetId) {
      const seriesPlan = await loadSeriesPlan(seriesRef.collectionId, seriesRef.seriesId);
      const seriesArt = seriesPlan?.articles.find(a => a.id === seriesRef.articleId);
      if (seriesArt?.articleId) existingArticleId = seriesArt.articleId;
    }

    let article: { id: string };
    if (existingArticleId) {
      article = { id: existingArticleId };
      await saveBlueprint(existingArticleId, makeBlueprint(plan.title || "无标题", plan));
      await saveArticleContent(existingArticleId, makeSkeletonDoc(plan));
    } else if (seriesRef && seriesRef.collectionId === targetId) {
      article = { id: seriesRef.articleId };
      await saveBlueprint(seriesRef.articleId, makeBlueprint(plan.title || "无标题", plan));
    } else {
      const newArticle = await addArticle(targetId, plan.title || "无标题");
      if (!newArticle) return null;
      article = newArticle;
      await saveBlueprint(article.id, makeBlueprint(plan.title || "无标题", plan));
      await saveArticleContent(article.id, makeSkeletonDoc(plan));
    }

    // Link series article if applicable
    if (seriesRef && seriesRef.collectionId === targetId) {
      const seriesPlan = await loadSeriesPlan(seriesRef.collectionId, seriesRef.seriesId);
      if (seriesPlan) {
        await saveSeriesPlan(seriesRef.collectionId, {
          ...seriesPlan,
          articles: seriesPlan.articles.map(a =>
            a.id === seriesRef.articleId ? { ...a, status: "writing" as const, articleId: article.id } : a
          ),
        });
      }
      pendingSeriesArticleRef.current = null;
    }

    emit("collections-changed");
    return { articleId: article.id, collectionId: targetId };
  }, [pendingSeriesArticleRef]);

  return {
    setActiveArticleId, handleOpenArticle, handleBackToEdit, handleEnterEditor,
    handleApplyHeadingNumbers, handleDocPickerResult, syncSeriesArticleStatus,
    handlePhaseChange, handlePlanComplete, applyHeadingNumbersRef,
    pendingSeriesArticleRef, styleReady, activeArticleId,
  };
}

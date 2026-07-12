// useArticleLifecycle.ts — 文章 CRUD、阶段切换、规划完成（从 MainEditorPage 抽出）
import { useCallback, useEffect, useRef } from "react";
import { useCollection } from "./useCollection";
import { useDocument } from "./useDocument";
import { createDefaultBlueprint } from "../domain";
import type { OutlineSection } from "../domain";
import { useAgent } from "../lib/ai/agent";
import { loadArticleStyleConfig } from "../lib/editor/editorStyles";
import { ArticleContext } from "../lib/article/ArticleContext";
import { emit } from "../lib/events/eventBus";
import { useToastStore } from "../store/toastStore";
import { useArticleStore } from "../store/articleStore";
import { useEditorStore } from "../store/editorStore";
import { usePanelStore } from "../store/panelStore";
import { useArticleLifecycleRefs } from "./appHooks";

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
  const { loadCollections, createCollection, addArticle, loadSeriesPlan, saveSeriesPlan, loadAllSeriesPlans } = useCollection();
  const { saveBlueprint, saveArticleContent } = useDocument();
  const {
    applyHeadingNumbersRef, pendingSeriesArticleRef, prevArticleRef,
    styleReady, setStyleReady,
  } = useArticleLifecycleRefs();

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

  // ── 追踪新建文章：跳过持久化第一轮脏闭包值 ──
  const freshArticleRef = useRef<string | null>(null);

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
        freshArticleRef.current = null;
      } else {
        // 新文章：标记 + 立即写入整份默认配置（含 articleThemeId 等），
        // 防止后续持久化闭包使用旧文章的值
        freshArticleRef.current = activeArticleId;
        setEditorStyleTemplate('default');
        setEditorLineHeight(1.75);
        setEditorFontSize(15);
        setEditorMaxWidth(820);
        setEditorParagraphGap(1.25);
        setEditorFontFamily('');
        setCodeThemeId('atom-one-light');
        new ArticleContext(activeArticleId).updateStyle({
          editorStyleTemplateId: 'default', lineHeight: 1.75,
          editorFontSize: 15, editorMaxWidth: 820,
          editorParagraphGap: 1.25, editorFontFamily: '',
          codeThemeId: 'atom-one-light',
          articleThemeId: 'clean',
          macosCodeBlock: false, firstLineIndent: false,
          justifyAlign: false, headingConfig: {},
          bgPattern: '', accentColor: '',
          captionFormat: '', customCSS: '',
        });
      }
    }
    prevArticleRef.current = activeArticleId;
    setStyleReady(n => n + 1);
  }, [activeArticleId]);

  // ── Style persistence (on every change) ──
  useEffect(() => {
    if (!activeArticleId) return;
    // 新建文章首次抵达时，闭包值可能仍为旧文章的，跳过此轮写入
    if (freshArticleRef.current === activeArticleId) {
      freshArticleRef.current = null;
      return;
    }
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
    } catch { console.warn("[ArticleLifecycle] syncSeriesArticleStatus failed (non-critical)"); }
  }, [loadCollections, loadAllSeriesPlans, saveSeriesPlan]);

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
    const addToast = useToastStore.getState().addToast;
    let targetId = collectionId;
    try {
      const cols = await loadCollections();
      if (!targetId || !cols.some(c => c.id === targetId)) {
        targetId = cols.length > 0 ? cols[0].id : (await createCollection("默认合集")).id;
      }
    } catch (e) {
      addToast({ type: "error", message: "加载文集列表失败：" + (e as Error).message });
      return null;
    }

    // Check series article for existing articleId
    let existingArticleId: string | null = null;
    const seriesRef = pendingSeriesArticleRef.current;
    if (seriesRef && seriesRef.collectionId === targetId) {
      try {
        const seriesPlan = await loadSeriesPlan(seriesRef.collectionId, seriesRef.seriesId);
        const seriesArt = seriesPlan?.articles.find(a => a.id === seriesRef.articleId);
        if (seriesArt?.articleId) existingArticleId = seriesArt.articleId;
      } catch (e) {
        addToast({ type: "warning", message: "加载系列计划失败：" + (e as Error).message });
      }
    }

    let article: { id: string };
    try {
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
    } catch (e) {
      addToast({ type: "error", message: "保存文章失败：" + (e as Error).message });
      return null;
    }

    // Link series article if applicable
    if (seriesRef && seriesRef.collectionId === targetId) {
      try {
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
      } catch (e) {
        addToast({ type: "warning", message: "更新系列状态失败：" + (e as Error).message });
      }
    }

    emit("collections-changed");
    addToast({ type: "success", message: "文章创建成功" });
    return { articleId: article.id, collectionId: targetId };
  }, [pendingSeriesArticleRef]);

  return {
    setActiveArticleId, handleOpenArticle, handleBackToEdit, handleEnterEditor,
    handleApplyHeadingNumbers, handleDocPickerResult, syncSeriesArticleStatus,
    handlePhaseChange, handlePlanComplete, applyHeadingNumbersRef,
    pendingSeriesArticleRef, styleReady, activeArticleId,
  };
}

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Sidebar } from "../components/sidebar/Sidebar";
import { EditorPane } from "../components/editor/EditorPane";
import { AgentPanel } from "../components/agent/AgentPanel";
import { ThemePicker } from "../components/settings/ThemePicker";
import { SettingsPanel } from "../components/settings";
import { StylePanel } from "../components/settings/StylePanel";
import { StatusBar, type SaveState } from "../components/common/StatusBar";
import { ProjectExplorer } from "../components/common/ProjectExplorer";
import { ArticleManager } from "../components/collections/ArticleManager";
import { DocPicker, type DocPickerResult } from "../components/collections/DocPicker";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { CommandPalette } from "../components/common/CommandPalette";
import type { SettingsTab } from "../components/settings";
import { saveBlueprint, loadBlueprint, createDefaultBlueprint, type OutlineSection } from "../lib/ai/articleBlueprint";
import type { OutlineItem } from "../components/sidebar/OutlinePanel";
import {
  type Theme,
  type ThemeStyle,
} from "../lib/theme/theme";
import {
  type TextSize,
} from "../lib/theme/textSize";
import {
  type FontFamily,
} from "../lib/theme/fontFamily";
import { loadCollections, addCollection, addArticle, genId,
  linkCollectionFolder, unlinkCollectionFolder, saveSeriesPlan, loadSeriesPlan,
  type SeriesPlan,
} from "../lib/storage/collections";

import { SeriesPlanner } from "../components/series/SeriesPlanner";
import { ArticleFinalPage } from "../components/editor/ArticleFinalPage";
import { saveArticleContent } from "../lib/storage/articles";
import { useAgent } from "../lib/ai/agent";
import { loadArticleStyleConfig } from "../lib/editor/editorStyles";
import { useThemeHandlers, useArticleLifecycle, useSeriesEventListeners } from "../hooks/appHooks";
import { emit } from "../lib/events/eventBus";
import { ArticleContext, ArticleCtx } from "../lib/article/ArticleContext";
// Zustand stores
import { useThemeStore } from "../store/themeStore";
import { useEditorStore } from "../store/editorStore";
import { useAppStore } from "../store/appStore";
export default function MainEditorPage() {
  // ── Theme store (replaces themeStyle, themeMode, textSize, fontFamily state) ──
  const themeStyle = useThemeStore((s) => s.themeStyle);
  const themeMode = useThemeStore((s) => s.themeMode);
  const textSize = useThemeStore((s) => s.textSize);
  const fontFamily = useThemeStore((s) => s.fontFamily);
  const setThemeStyle = useThemeStore((s) => s.setThemeStyle);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const setTextSize = useThemeStore((s) => s.setTextSize);
  const setFontFamily = useThemeStore((s) => s.setFontFamily);

  // ── Editor store (replaces editor* state) ──
  const editorFormat = useEditorStore((s) => s.format);
  const editorLineHeight = useEditorStore((s) => s.lineHeight);
  const editorStyleTemplate = useEditorStore((s) => s.styleTemplate);
  const editorFontSize = useEditorStore((s) => s.fontSize);
  const editorMaxWidth = useEditorStore((s) => s.maxWidth);
  const editorParagraphGap = useEditorStore((s) => s.paragraphGap);
  const editorFontFamily = useEditorStore((s) => s.fontFamily);
  const codeThemeId = useEditorStore((s) => s.codeThemeId);
  const showHeadingNumber = useEditorStore((s) => s.showHeadingNumber);
  const setEditorFormat = useEditorStore((s) => s.setFormat);
  const setEditorLineHeight = useEditorStore((s) => s.setLineHeight);
  const setEditorStyleTemplate = useEditorStore((s) => s.setStyleTemplate);
  const setEditorFontSize = useEditorStore((s) => s.setFontSize);
  const setEditorMaxWidth = useEditorStore((s) => s.setMaxWidth);
  const setEditorParagraphGap = useEditorStore((s) => s.setParagraphGap);
  const setEditorFontFamily = useEditorStore((s) => s.setFontFamily);
  const setCodeThemeId = useEditorStore((s) => s.setCodeThemeId);
  const setShowHeadingNumber = useEditorStore((s) => s.setShowHeadingNumber);

  // ── App store (replaces all UI/article state) ──
  const themePickerOpen = useAppStore((s) => s.themePickerOpen);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const settingsTab = useAppStore((s) => s.settingsTab);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen);
  const focusMode = useAppStore((s) => s.focusMode);
  const sidebarWidth = useAppStore((s) => s.sidebarWidth);
  const resizing = useAppStore((s) => s.resizing);
  const hasActiveArticle = useAppStore((s) => s.hasActiveArticle);
  const manageOpen = useAppStore((s) => s.manageOpen);
  const docPickerOpen = useAppStore((s) => s.docPickerOpen);
  const activeArticleId = useAppStore((s) => s.activeArticleId);
  const showFinalPage = useAppStore((s) => s.showFinalPage);
  const activeCollectionId = useAppStore((s) => s.activeCollectionId);
  const stylePanelOpen = useAppStore((s) => s.stylePanelOpen);
  const seriesPlannerOpen = useAppStore((s) => s.seriesPlannerOpen);
  const seriesPlannerColId = useAppStore((s) => s.seriesPlannerColId);
  const seriesPlannerColTitle = useAppStore((s) => s.seriesPlannerColTitle);
  const seriesPlannerFolder = useAppStore((s) => s.seriesPlannerFolder);
  const seriesPlannerExistingPlan = useAppStore((s) => s.seriesPlannerExistingPlan);
  const outlineItems = useAppStore((s) => s.outlineItems);
  const seriesRefreshKey = useAppStore((s) => s.seriesRefreshKey);
  const activeOutlineId = useAppStore((s) => s.activeOutlineId);
  const saveState = useAppStore((s) => s.saveState);
  const articlePhase = useAppStore((s) => s.articlePhase);
  const projectPanelOpen = useAppStore((s) => s.projectPanelOpen);

  const setThemePickerOpen = useAppStore((s) => s.setThemePickerOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setFocusMode = useAppStore((s) => s.setFocusMode);
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth);
  const setResizing = useAppStore((s) => s.setResizing);
  const setHasActiveArticle = useAppStore((s) => s.setHasActiveArticle);
  const setManageOpen = useAppStore((s) => s.setManageOpen);
  const setDocPickerOpen = useAppStore((s) => s.setDocPickerOpen);
  const setStylePanelOpen = useAppStore((s) => s.setStylePanelOpen);
  const setSeriesPlannerOpen = useAppStore((s) => s.setSeriesPlannerOpen);
  const setSeriesPlannerColId = useAppStore((s) => s.setSeriesPlannerColId);
  const setSeriesPlannerColTitle = useAppStore((s) => s.setSeriesPlannerColTitle);
  const setSeriesPlannerFolder = useAppStore((s) => s.setSeriesPlannerFolder);
  const setSeriesPlannerExistingPlan = useAppStore((s) => s.setSeriesPlannerExistingPlan);
  const setOutlineItems = useAppStore((s) => s.setOutlineItems);
  const setActiveOutlineId = useAppStore((s) => s.setActiveOutlineId);
  const incSeriesRefreshKey = useAppStore((s) => s.incSeriesRefreshKey);
  const setSaveState = useAppStore((s) => s.setSaveState);
  const setArticlePhase = useAppStore((s) => s.setArticlePhase);
  const setShowFinalPage = useAppStore((s) => s.setShowFinalPage);
  const setProjectPanelOpen = useAppStore((s) => s.setProjectPanelOpen);
  const setActiveArticleIdApp = useAppStore((s) => s.setActiveArticleId);
  const setActiveCollectionIdApp = useAppStore((s) => s.setActiveCollectionId);

  const { setActiveArticleId: setCtxArticleId } = useAgent();
  const setActiveArticleId = useCallback((id: string | null) => {
    setActiveArticleIdApp(id);
    if (setCtxArticleId) setCtxArticleId(id);
  }, [setCtxArticleId, setActiveArticleIdApp]);

  // ── Hooks migrated from inline logic ──
  const { handleSelectStyle, handleSelectMode, handleSelectTextSize, handleSelectFontFamily } = useThemeHandlers();
  const {
    applyHeadingNumbersRef,
    pendingSeriesArticleRef,
    prevArticleRef,
    styleReady,
    setStyleReady,
  } = useArticleLifecycle();
  const handleApplyHeadingNumbers = useCallback(() => {
    applyHeadingNumbersRef.current?.();
  }, [applyHeadingNumbersRef]);

  // Per-article style persistence
  useEffect(() => {
    const prevId = prevArticleRef.current;
    if (activeArticleId) {
      // 从 ArticleContext 读取样式配置（context 构造时已加载并应用）
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
        setEditorStyleTemplate('default');
        setEditorLineHeight(1.75);
        setEditorFontSize(15);
        setEditorMaxWidth(820);
        setEditorParagraphGap(1.25);
        setEditorFontFamily('');
        setCodeThemeId('atom-one-light');
      }
    }
    prevArticleRef.current = activeArticleId;
    // Trigger style panel re-mount
    setStyleReady(n => n + 1);
  }, [activeArticleId]);
  // ─── Sync React style state → localStorage on every change ───
  // Ensures export/compile functions read current values
  useEffect(() => {
    if (!activeArticleId) return;
    // 同步 editorStore 值到 localStorage（兼容旧代码读取）
    localStorage.setItem('editor-style-template', editorStyleTemplate);
    localStorage.setItem('editor-line-height', String(editorLineHeight));
    localStorage.setItem('editor-font-size', String(editorFontSize));
    localStorage.setItem('editor-max-width', String(editorMaxWidth));
    localStorage.setItem('editor-paragraph-gap', String(editorParagraphGap));
    localStorage.setItem('editor-font-family', editorFontFamily);
    localStorage.setItem('code-theme-id', codeThemeId);
    // 通过 context 持久化到文章专属键
    const ctx = new ArticleContext(activeArticleId);
    ctx.updateStyle({
      editorStyleTemplateId: editorStyleTemplate,
      lineHeight: editorLineHeight,
      editorFontSize: editorFontSize,
      editorMaxWidth: editorMaxWidth,
      editorParagraphGap: editorParagraphGap,
      editorFontFamily: editorFontFamily,
      codeThemeId: codeThemeId,
    });
  }, [
    activeArticleId, editorStyleTemplate, editorLineHeight, editorFontSize,
    editorMaxWidth, editorParagraphGap, editorFontFamily, codeThemeId,
  ]);

  const layoutRef = useRef<HTMLDivElement>(null);

    const handleOpenArticle = useCallback((articleId: string, collectionId: string) => {
    setActiveArticleId(articleId);
    setActiveCollectionIdApp(collectionId);
    setHasActiveArticle(true);
  }, []);

const handlePlanComplete = useCallback(async (plan: {
    title: string;
    description: string;
    outline: OutlineSection[];
    tags: string[];
    tone: string;
    targetAudience: string;
    targetWordCount: number;
  }, collectionId: string): Promise<{ articleId: string; collectionId: string } | null> => {
    // Ensure target collection exists
    let targetId = collectionId;
    const cols = await loadCollections();
    if (!targetId || !cols.some(c => c.id === targetId)) {
      targetId = cols.length > 0 ? cols[0].id : (await addCollection("默认合集")).id;
    }
    // Check if this is from a series plan that already has an articleId
    let existingArticleId: string | null = null;
    if (pendingSeriesArticleRef.current && pendingSeriesArticleRef.current.collectionId === targetId) {
      const ref = pendingSeriesArticleRef.current;
      const seriesPlan = await loadSeriesPlan(ref.collectionId, ref.seriesId);
      if (seriesPlan) {
        const seriesArt = seriesPlan.articles.find(a => a.id === pendingSeriesArticleRef.current!.articleId);
        if (seriesArt && seriesArt.articleId) {
          existingArticleId = seriesArt.articleId;
        }
      }
    }
    
    let article;
    if (existingArticleId) {
      // Update existing article
      article = { id: existingArticleId };
      const bp = createDefaultBlueprint(plan.title || "无标题");
      bp.workingTitle = plan.title || "无标题";
      bp.description = plan.description || "";
      bp.tone = plan.tone || undefined;
      bp.targetAudience = plan.targetAudience || undefined;
      bp.targetWordCount = plan.targetWordCount || undefined;
      bp.tags = plan.tags || [];
      bp.outline = plan.outline || [];
      bp.phase = "reviewing";
      await saveBlueprint(existingArticleId, bp);
      let doc = "";
      if (plan.description) {
        doc += plan.description + "\n\n";
      }
      if (plan.outline && plan.outline.length > 0) {
        for (const section of plan.outline) {
          const heading = "#".repeat(Math.min(section.level + 1, 4));
          doc += heading + " " + section.title + "\n\n\n";
        }
      }
      await saveArticleContent(existingArticleId, doc);
    } else if (pendingSeriesArticleRef.current && pendingSeriesArticleRef.current.collectionId === targetId) {
      // Series article: use its own id, no duplicate collection entry
      const seriesId = pendingSeriesArticleRef.current.articleId;
      article = { id: seriesId };
      const bp = createDefaultBlueprint(plan.title || "无标题");
      bp.workingTitle = plan.title || "无标题";
      bp.description = plan.description || "";
      bp.tone = plan.tone || undefined;
      bp.targetAudience = plan.targetAudience || undefined;
      bp.targetWordCount = plan.targetWordCount || undefined;
      bp.tags = plan.tags || [];
      bp.outline = plan.outline || [];
      bp.phase = "reviewing";
      await saveBlueprint(seriesId, bp);
      // Don't save skeleton content — writeAllSections will build from scratch
    } else {
      // Create new article (non-series)
      const newArticle = await addArticle(targetId, plan.title || "无标题");
      if (!newArticle) return null;
      article = newArticle;
      const bp = createDefaultBlueprint(plan.title || "无标题");
      bp.workingTitle = plan.title || "无标题";
      bp.description = plan.description || "";
      bp.tone = plan.tone || undefined;
      bp.targetAudience = plan.targetAudience || undefined;
      bp.targetWordCount = plan.targetWordCount || undefined;
      bp.tags = plan.tags || [];
      bp.outline = plan.outline || [];
      bp.phase = "reviewing";
      await saveBlueprint(article.id, bp);
      let doc = "";
      if (plan.description) {
        doc += plan.description + "\n\n";
      }
      if (plan.outline && plan.outline.length > 0) {
        for (const section of plan.outline) {
          const heading = "#".repeat(Math.min(section.level + 1, 4));
          doc += heading + " " + section.title + "\n\n\n";
        }
      }
      await saveArticleContent(article.id, doc);
    }
    
    // Link series article if applicable
    if (pendingSeriesArticleRef.current && pendingSeriesArticleRef.current.collectionId === targetId) {
      const ref = pendingSeriesArticleRef.current;
      const seriesPlan = await loadSeriesPlan(ref.collectionId, ref.seriesId);
      if (seriesPlan) {
        const updated = seriesPlan.articles.map((a: any) =>
          a.id === pendingSeriesArticleRef.current!.articleId
            ? { ...a, status: "writing", articleId: article.id }
            : a
        );
        await saveSeriesPlan(pendingSeriesArticleRef.current.collectionId, { ...seriesPlan, articles: updated });
      }
      pendingSeriesArticleRef.current = null;
    }
    
    emit("collections-changed");
    return { articleId: article.id, collectionId: targetId };
  }, []);

  const handleBackToEdit = useCallback(() => {
    setShowFinalPage(false);
    closePanel();
    setStylePanelOpen(false);
  }, []);

  const handleEnterEditor = useCallback((articleId: string, collectionId: string) => {
    setActiveArticleId(articleId);
    setActiveCollectionIdApp(collectionId);
    setHasActiveArticle(true);
    setShowFinalPage(false);
  }, []);

  const handleDocPickerResult = useCallback(async (result: DocPickerResult) => {
    if (result.action === "open" && result.articleId) {
      // Just open the article
      setActiveArticleId(result.articleId);
      setActiveCollectionIdApp(result.collectionId || null);
      setHasActiveArticle(true);
    } else if (result.action === "create" && result.collectionId) {
      // Create a new article in the selected collection
      setActiveCollectionIdApp(result.collectionId);
      // Create article directly
      const article = await addArticle(result.collectionId, "无标题");
      if (article) {
        setActiveArticleId(article.id);
        setHasActiveArticle(true);
      }
    } else if (result.action === "plan" && result.collectionId) {
      // Go to plan mode - set collection and show splash
      setActiveCollectionIdApp(result.collectionId);
      setHasActiveArticle(false);
      setActiveArticleId(null);
    }
  }, []);

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
      closePanel();
      setStylePanelOpen(false);
      setShowFinalPage(true);
      // Sync series plan status
      if (aid) syncSeriesArticleStatus(aid, "complete");
    } else if (phase === "writing" && aid) {
      setShowFinalPage(false);
      syncSeriesArticleStatus(aid, "writing");
    } else {
      setShowFinalPage(false);
    }
  }, [activeArticleId, syncSeriesArticleStatus]);

  const openSettings = useCallback(() => {
    setSettingsTab("appearance");
    setSettingsOpen(true);
  }, []);

  // Outline handlers
  const handleOutlineChange = useCallback((items: any[]) => {
    setOutlineItems(items);
  }, []);

  const handleOutlineSelect = useCallback((id: string) => {
    setActiveOutlineId(id);
    // Find the heading text from outline items
    const item = outlineItems.find(i => i.id === id);
    if (item) {
      emit("outline-navigate", { headingText: item.text });
    }
  }, [outlineItems]);

  // Resize handlers
  const startResize = useCallback(
    (type: "sidebar") => (e: React.PointerEvent) => {
      setResizing(type);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [],
  );

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      if (!layoutRef.current) return;
      const rect = layoutRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;

      if (resizing === "sidebar") {
        const w = Math.max(200, Math.min(320, x));
        setSidebarWidth(w);
      }
    };
    const onUp = () => setResizing(null);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [resizing]);

  // Keyboard shortcuts
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
  }, []);


  // ── Series event listeners (migrated to hooks) ──
  useSeriesEventListeners(pendingSeriesArticleRef);
  // Layout class
  const { panelOpen, closePanel } = useAgent();
  const layoutClass = [
    "layout",
    sidebarOpen ? "layout--sidebar-open" : "",
    panelOpen ? "layout--ai-open" : "",
    stylePanelOpen ? "layout--style-open" : "",
    resizing ? "layout--resizing" : "",
    focusMode ? "layout--focus" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // ── Article context (per-article state, lifecycle = sidebar selection) ──
  const articleCtx = useMemo(
    () => (activeArticleId ? new ArticleContext(activeArticleId) : null),
    [activeArticleId],
  );
  return (
    <ErrorBoundary name="app">
    <div className={"app" + (focusMode ? " app--focus" : "")}>
      <div
        ref={layoutRef}
        className={layoutClass}
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
            "--ai-dock-width": "420px",
          } as React.CSSProperties
        }
      >
        {/* Sidebar */}
        <Sidebar
          seriesRefreshKey={seriesRefreshKey}
          onOpenSettings={openSettings}
          onSelectArticle={async (id) => {
            closePanel();
            setStylePanelOpen(false);
            setActiveArticleId(id);
            setHasActiveArticle(true);
            const cols = await loadCollections();
            for (const c of cols) {
              if (c.articles.some(a => a.id === id)) {
                setActiveCollectionIdApp(c.id);
                break;
              }
            }
            // Check if article is complete -> show final page
            const bp = await loadBlueprint(id);
            setShowFinalPage(bp?.phase === "complete");
          }}
          activeArticleId={activeArticleId}
          onNewArticle={async () => {
            closePanel();
            setStylePanelOpen(false);
            setShowFinalPage(false);
            setProjectPanelOpen(false);
            // Navigate to welcome/start page (StartupSplash)
            setActiveArticleId(null);
            setActiveCollectionIdApp(null);
            setHasActiveArticle(false);
          }}

          onNewArticleInCollection={async (collectionId: string) => {
            closePanel();
            setStylePanelOpen(false);
            setShowFinalPage(false);
            setProjectPanelOpen(false);
            // Navigate to StartupSplash with collection context
            setActiveArticleId(null);
            setActiveCollectionIdApp(collectionId);
            setHasActiveArticle(false);
            // Force plan state reset even if same collection
            emit('reset-plan');
          }}
          onManageArticles={() => setManageOpen(true)}
          outlineItems={outlineItems}
          activeOutlineId={activeOutlineId ?? undefined}
          onOutlineSelect={handleOutlineSelect}

        />

        {/* Sidebar Resizer */}
        <button
          className="sidebar-resizer"
          onPointerDown={startResize("sidebar")}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整侧栏宽度"
        />

        <ArticleCtx.Provider value={articleCtx}>
        {/* Project Explorer (linked folder) */}
        {projectPanelOpen && !hasActiveArticle ? (
          <ProjectExplorer />
        ) : showFinalPage && activeArticleId ? (
          <ArticleFinalPage
            articleId={activeArticleId}
            collectionId={activeCollectionId ?? ""}
            onBackToEdit={handleBackToEdit}
            genId={genId}
          />
        ) : (
        <EditorPane
          key={(activeArticleId ?? "") + styleReady}
          hasActiveArticle={hasActiveArticle}
          activeArticleId={activeArticleId}
          activeCollectionId={activeCollectionId}
          onNewDoc={async (collectionId?: string) => {
            if (collectionId) {
              // Quick start: create blank article
              const cols = await loadCollections();
              const targetId = collectionId || activeCollectionId || (cols.length > 0 ? cols[0].id : (await addCollection("默认合集")).id);
              const article = await addArticle(targetId, "无标题");
              if (article) {
                setActiveArticleId(article.id);
                setActiveCollectionIdApp(targetId);
                setHasActiveArticle(true);
              }
              return;
            }
            // No collectionId: open DocPicker
            setDocPickerOpen(true);
          }}
          onPlanComplete={handlePlanComplete}
          onEnterEditor={handleEnterEditor}
          onToggleFocus={() => setFocusMode(!focusMode)}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onSaveStateChange={setSaveState}
          onPhaseChange={handlePhaseChange}
          editorMode={editorFormat}
          editorLineHeight={editorLineHeight}
          editorStyleTemplateId={editorStyleTemplate}
          onSetEditorFormat={setEditorFormat}
          onSetEditorLineHeight={setEditorLineHeight}
          editorFontSize={editorFontSize}
          editorMaxWidth={editorMaxWidth}
          editorParagraphGap={editorParagraphGap}
          editorFontFamily={editorFontFamily}
          codeThemeId={codeThemeId}
          onSetEditorStyleTemplate={setEditorStyleTemplate}
          onOutlineChange={handleOutlineChange}
          applyHeadingNumbersRef={applyHeadingNumbersRef}
          showHeadingNumber={showHeadingNumber}
          onToggleStylePanel={() => { closePanel(); setStylePanelOpen(!stylePanelOpen); }}
          onCloseStylePanel={() => setStylePanelOpen(false)}
        />

        )}
        {/* Agent Panel */}
        <AgentPanel />
        {/* Style Panel */}
        <StylePanel
          key={activeArticleId}
          open={stylePanelOpen}
          onClose={() => setStylePanelOpen(false)}
          editorStyleTemplateId={editorStyleTemplate}
          lineHeight={editorLineHeight}
          onSetEditorStyleTemplate={setEditorStyleTemplate}
          onSetLineHeight={setEditorLineHeight}
          editorFontSize={editorFontSize}
          onSetEditorFontSize={setEditorFontSize}
          editorMaxWidth={editorMaxWidth}
          editorParagraphGap={editorParagraphGap}
          editorFontFamily={editorFontFamily}
          onSetEditorFontFamily={setEditorFontFamily}
          codeThemeId={codeThemeId}
          onSetCodeTheme={setCodeThemeId}
          onApplyHeadingNumbers={handleApplyHeadingNumbers}
        />
      </ArticleCtx.Provider>
      </div>

      {/* Focus mode exit button */}
      {focusMode && (
        <button
          className="focus-exit-btn"
          onClick={() => setFocusMode(false)}
          title="退出焦点模式 (Esc)"
        >
          Exit Focus
        </button>
      )}

      {/* Status bar (full-width bottom) */}
      <StatusBar saveState={saveState} phase={articlePhase} />

      {/* Theme Picker */}
      <ThemePicker
        currentStyle={themeStyle}
        currentMode={themeMode}
        open={themePickerOpen}
        onClose={() => setThemePickerOpen(false)}
        onSelectStyle={handleSelectStyle}
        onSelectMode={handleSelectMode}
      />

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        initialTab={settingsTab}
        currentStyle={themeStyle}
        currentTheme={themeMode}
        currentTextSize={textSize}
        currentFontFamily={fontFamily}
        currentEditorFormat={editorFormat}
        currentEditorLineHeight={editorLineHeight}
        onClose={() => setSettingsOpen(false)}
        onSelectStyle={handleSelectStyle}
        onSelectTheme={handleSelectMode}
        onSelectTextSize={handleSelectTextSize}
        onSelectFontFamily={handleSelectFontFamily}
        onSetEditorFormat={setEditorFormat}
        onSetEditorLineHeight={setEditorLineHeight}
      />
          {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        extraCommands={[
          { id: "toggle-focus", label: focusMode ? "退出焦点模式" : "进入焦点模式", icon: null, shortcut: "⌘⇧F", action: () => { setFocusMode(!focusMode); setCommandPaletteOpen(false); } },
        ]}
      />

      {/* DocPicker */}
      <DocPicker
        open={docPickerOpen}
        onClose={() => setDocPickerOpen(false)}
        onResult={handleDocPickerResult}
        activeCollectionId={activeCollectionId}
      />

      {/* Article Manager */}
      <ArticleManager
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onOpenArticle={handleOpenArticle}
      />

      <SeriesPlanner
        open={seriesPlannerOpen}
        collectionId={seriesPlannerColId || ""}
        collectionTitle={seriesPlannerColTitle}
        linkedFolder={seriesPlannerFolder}
        existingPlan={seriesPlannerExistingPlan}
        onSave={async (plan: SeriesPlan) => {
          if (seriesPlannerColId) {
            await saveSeriesPlan(seriesPlannerColId, plan);
            emit("plan-series-saved", { collectionId: seriesPlannerColId });
            incSeriesRefreshKey();
          }
          setSeriesPlannerOpen(false);
        }}
        onClose={() => {
          setSeriesPlannerOpen(false);
          setSeriesPlannerExistingPlan(null);
        }}
      />
</div>
    </ErrorBoundary>
  );
}

import { useState, useCallback, useEffect, useRef } from "react";
import { AgentProvider } from "./components/AgentProvider";
import { Sidebar } from "./components/Sidebar";
import { EditorPane } from "./components/EditorPane";
import { AgentPanel } from "./components/AgentPanel";
import { ThemePicker } from "./components/ThemePicker";
import { SettingsPanel } from "./components/SettingsPanel";
import { StylePanel } from "./components/StylePanel";
import { StatusBar, type SaveState } from "./components/StatusBar";
import { ArticleManager } from "./components/ArticleManager";
import { DocPicker, type DocPickerResult } from "./components/DocPicker";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CommandPalette } from "./components/CommandPalette";
import type { SettingsTab } from "./components/SettingsPanel";
import { saveBlueprint, loadBlueprint, createDefaultBlueprint, type ArticleBlueprint, type OutlineSection } from "./lib/articleBlueprint";
import type { OutlineItem } from "./components/OutlinePanel";
import {
  applyTheme,
  getTheme,
  getThemeStyle,
  persistTheme,
  type Theme,
  type ThemeStyle,
} from "./lib/theme";
import {
  applyTextSize,
  getTextSize,
  type TextSize,
} from "./lib/textSize";
import {
  applyFontFamily,
  getFontFamily,
  type FontFamily,
} from "./lib/fontFamily";
import { loadCollections, addCollection, addArticle, renameArticle, genId,
  linkCollectionFolder, unlinkCollectionFolder, saveSeriesPlan, loadSeriesPlan, loadAllSeriesPlans,
  type SeriesPlan,
} from "./lib/collections";

import { SeriesPlanner } from "./components/SeriesPlanner";
import { ArticleFinalPage } from "./components/ArticleFinalPage";
import { saveArticleContent } from "./lib/articles";
import { useAgent } from "./lib/agent";
import { getProviders } from "./lib/providerModels";
import { saveArticleStyleConfig, loadArticleStyleConfig, applyArticleStyleConfig } from "./lib/editorStyles";

function AppContent() {
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>(getThemeStyle());
  const [themeMode, setThemeMode] = useState<Theme>(getTheme());
  const [textSize, setTextSize] = useState<TextSize>(getTextSize());
  const [fontFamily, setFontFamily] = useState<FontFamily>(getFontFamily());
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("appearance");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(264);
  const [resizing, setResizing] = useState<"sidebar" | null>(null);
  const [hasActiveArticle, setHasActiveArticle] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [activeArticleId, setLocalArticleId] = useState<string | null>(null);
  const [showFinalPage, setShowFinalPage] = useState(false);
  const { setActiveArticleId: setCtxArticleId } = useAgent();
  const setActiveArticleId = useCallback((id: string | null) => {
    setLocalArticleId(id);
    if (setCtxArticleId) setCtxArticleId(id);
  }, [setCtxArticleId]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [editorFormat, setEditorFormat] = useState<"rich" | "markdown">("rich");
  const [editorLineHeight, setEditorLineHeight] = useState(1.75);
  const [editorStyleTemplate, setEditorStyleTemplate] = useState<string>("default");
  const [editorFontSize, setEditorFontSize] = useState(15);
  const [editorMaxWidth, setEditorMaxWidth] = useState(820);
  const [editorParagraphGap, setEditorParagraphGap] = useState(1.25);
  const [editorFontFamily, setEditorFontFamily] = useState("");
  const [codeThemeId, setCodeThemeId] = useState("atom-one-light");
  const [showHeadingNumber, setShowHeadingNumber] = useState(false);
  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const applyHeadingNumbersRef = useRef<(() => void) | null>(null);
  const handleApplyHeadingNumbers = useCallback(() => {
    applyHeadingNumbersRef.current?.();
  }, []);
  const [seriesPlannerOpen, setSeriesPlannerOpen] = useState(false);
  const [seriesPlannerColId, setSeriesPlannerColId] = useState<string | null>(null);
  const [seriesPlannerColTitle, setSeriesPlannerColTitle] = useState("");
  const [seriesPlannerFolder, setSeriesPlannerFolder] = useState("");
  const [seriesPlannerExistingPlan, setSeriesPlannerExistingPlan] = useState<any>(null);
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([]);
  const [seriesRefreshKey, setSeriesRefreshKey] = useState(0);
  const pendingSeriesArticleRef = useRef<{ collectionId: string; seriesId: string; articleId: string } | null>(null);
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [articlePhase, setArticlePhase] = useState<string | undefined>(undefined);
  const prevArticleRef = useRef<string | null>(null);
  const [styleReady, setStyleReady] = useState(0);

  // Per-article style persistence
  useEffect(() => {
    const prevId = prevArticleRef.current;
    if (prevId && prevId !== activeArticleId && activeArticleId) {
      saveArticleStyleConfig(prevId);
    }
    if (activeArticleId) {
      const config = loadArticleStyleConfig(activeArticleId);
      if (config) {
        applyArticleStyleConfig(config);
        setEditorStyleTemplate(config.editorStyleTemplateId);
        setEditorLineHeight(config.lineHeight);
        setEditorFontSize(config.editorFontSize);
        setEditorMaxWidth(config.editorMaxWidth);
        setEditorParagraphGap(config.editorParagraphGap);
        setEditorFontFamily(config.editorFontFamily);
        setCodeThemeId(config.codeThemeId);
      }
      window.dispatchEvent(new CustomEvent("article-theme-changed"));
    }
    prevArticleRef.current = activeArticleId;
    // Trigger style panel re-mount
    setStyleReady(n => n + 1);
  }, [activeArticleId]);
  // ─── Sync React style state → localStorage on every change ───
  // Ensures export/compile functions read current values
  useEffect(() => {
    if (!activeArticleId) return;
    localStorage.setItem('editor-style-template', editorStyleTemplate);
    localStorage.setItem('editor-line-height', String(editorLineHeight));
    localStorage.setItem('editor-font-size', String(editorFontSize));
    localStorage.setItem('editor-max-width', String(editorMaxWidth));
    localStorage.setItem('editor-paragraph-gap', String(editorParagraphGap));
    localStorage.setItem('editor-font-family', editorFontFamily);
    localStorage.setItem('code-theme-id', codeThemeId);
    // Save per-article config so it persists
    saveArticleStyleConfig(activeArticleId);
  }, [
    activeArticleId, editorStyleTemplate, editorLineHeight, editorFontSize,
    editorMaxWidth, editorParagraphGap, editorFontFamily, codeThemeId,
  ]);

  const layoutRef = useRef<HTMLDivElement>(null);

  // Theme handlers
  const handleSelectStyle = useCallback(
    (style: ThemeStyle) => {
      setThemeStyle(style);
      applyTheme(themeMode, style);
      persistTheme(themeMode, style);
    },
    [themeMode],
  );

  const handleSelectMode = useCallback(
    (mode: Theme) => {
      setThemeMode(mode);
      applyTheme(mode, themeStyle);
      persistTheme(mode, themeStyle);
    },
    [themeStyle],
  );

  // Text size handler
  const handleSelectTextSize = useCallback((size: TextSize) => {
    setTextSize(size);
    applyTextSize(size);
  }, []);

  // Font family handler
  const handleSelectFontFamily = useCallback((font: FontFamily) => {
    setFontFamily(font);
    applyFontFamily(font);
  }, []);

  const openAppearance = useCallback(() => {
    setSettingsTab("appearance");
    setSettingsOpen(true);
  }, []);

    const handleOpenArticle = useCallback((articleId: string, collectionId: string) => {
    setActiveArticleId(articleId);
    setActiveCollectionId(collectionId);
    setHasActiveArticle(true);
  }, []);

  const handleCloseManagement = useCallback(() => {
    setManageOpen(false);
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
    
    window.dispatchEvent(new CustomEvent("collections-changed"));
    return { articleId: article.id, collectionId: targetId };
  }, []);

  const handleBackToEdit = useCallback(() => {
    setShowFinalPage(false);
    closePanel();
    setStylePanelOpen(false);
  }, []);

  const handleEnterEditor = useCallback((articleId: string, collectionId: string) => {
    setActiveArticleId(articleId);
    setActiveCollectionId(collectionId);
    setHasActiveArticle(true);
    setShowFinalPage(false);
  }, []);

  const handleDocPickerResult = useCallback(async (result: DocPickerResult) => {
    if (result.action === "open" && result.articleId) {
      // Just open the article
      setActiveArticleId(result.articleId);
      setActiveCollectionId(result.collectionId || null);
      setHasActiveArticle(true);
    } else if (result.action === "create" && result.collectionId) {
      // Create a new article in the selected collection
      setActiveCollectionId(result.collectionId);
      // Create article directly
      const article = await addArticle(result.collectionId, "无标题");
      if (article) {
        setActiveArticleId(article.id);
        setHasActiveArticle(true);
      }
    } else if (result.action === "plan" && result.collectionId) {
      // Go to plan mode - set collection and show splash
      setActiveCollectionId(result.collectionId);
      setHasActiveArticle(false);
      setActiveArticleId(null);
    }
  }, []);

  const handlePhaseChange = useCallback((phase: string) => {
    setArticlePhase(phase);
    if (phase === "complete") {
      closePanel();
      setStylePanelOpen(false);
      setShowFinalPage(true);
    } else {
      setShowFinalPage(false);
    }
  }, []);

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
      window.dispatchEvent(new CustomEvent("outline-navigate", { detail: { headingText: item.text } }));
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
        setSidebarOpen((o) => !o);
      }
      if (ctrl && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      if (ctrl && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(p => !p);
      }
      if (ctrl && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setFocusMode(f => !f);
      }
      if (e.key === "Escape") {
        setFocusMode(false);
        setThemePickerOpen(false);
        setSettingsOpen(false);
        setCommandPaletteOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);


  // Listen for plan-series event (from CollectionTree)
  useEffect(() => {
    const handler = (e: Event) => {
      const { collectionId } = (e as CustomEvent).detail;
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
    window.addEventListener("plan-series", handler);
    return () => window.removeEventListener("plan-series", handler);
  }, []);

  // Listen for edit-series-plan event (from SeriesOverview "编辑规划")
  useEffect(() => {
    const handler = async (e: Event) => {
      const { collectionId, seriesId } = (e as CustomEvent).detail;
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
    window.addEventListener("edit-series-plan", handler);
    return () => window.removeEventListener("edit-series-plan", handler);
  }, []);

  // Listen for plan-series-article event (from SeriesOverview → navigate to planning)
  useEffect(() => {
    const handler = async (e: Event) => {
      const { collectionId, seriesId: eventSeriesId, article } = (e as CustomEvent).detail;
      if (!collectionId || !article) return;
      try {
        // Don't create article yet — handlePlanComplete will do it on confirm
        // Store the series article info so we can link after creation
        pendingSeriesArticleRef.current = { collectionId, seriesId: eventSeriesId || '', articleId: article.id };
        
        // Navigate to StartupSplash
        setActiveArticleId(null);
        setActiveCollectionId(collectionId);
        setHasActiveArticle(false);
        
        // Read tone/audience from series plan
        const seriesPlan = await loadSeriesPlan(collectionId, eventSeriesId || "");
        const seriesTone = seriesPlan?.tone;
        const seriesAudience = seriesPlan?.targetAudience;
        const seriesSkillId = seriesPlan?.skillId;
        
        // Dispatch event for EditorPane to auto-start planning
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("auto-plan-article", {
            detail: { 
              collectionId,
              title: article.title,
              description: article.description || "",
              tone: seriesTone,
              targetAudience: seriesAudience,
              skillId: seriesSkillId,
              targetWordCount: article.targetWordCount,
            }
          }));
        }, 100);
        
        window.dispatchEvent(new Event("collections-changed"));
      } catch (err) {
        console.warn("创建系列文章失败:", err);
      }
    };
    window.addEventListener("plan-series-article", handler);
    return () => window.removeEventListener("plan-series-article", handler);
  }, []);

  // Listen for series-article-review (writing complete → update status to reviewing)
  useEffect(() => {
    const handler = async (e: Event) => {
      const { articleId, collectionId, seriesId: eventSeriesId } = (e as CustomEvent).detail;
      if (!articleId || !collectionId) return;
      try {
        // Try to find the series that contains this article
        let seriesPlan: SeriesPlan | null = null;
        if (eventSeriesId) {
          seriesPlan = await loadSeriesPlan(collectionId, eventSeriesId);
        } else {
          // Scan all plans to find the one containing this articleId
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
        window.dispatchEvent(new Event("collections-changed"));
      } catch (err) {
        console.warn("series-article-review 更新状态失败:", err);
      }
    };
    window.addEventListener("series-article-review", handler);
    return () => window.removeEventListener("series-article-review", handler);
  }, []);
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
                setActiveCollectionId(c.id);
                break;
              }
            }
            // Check if article is complete -> show final page
            const bp = await loadBlueprint(id);
            setShowFinalPage(bp?.phase === "complete");
          }}
          activeArticleId={activeArticleId}
          activeCollectionId={activeCollectionId}
          onNewArticle={async () => {
            closePanel();
            setStylePanelOpen(false);
            setShowFinalPage(false);
            // Navigate to welcome/start page (StartupSplash)
            setActiveArticleId(null);
            setActiveCollectionId(null);
            setHasActiveArticle(false);
          }}
          onNewArticleInCollection={async (collectionId: string) => {
            closePanel();
            setStylePanelOpen(false);
            setShowFinalPage(false);
            // Navigate to StartupSplash with collection context
            setActiveArticleId(null);
            setActiveCollectionId(collectionId);
            setHasActiveArticle(false);
          }}
          onManageArticles={() => setManageOpen(true)}
          onLinkFolder={async (collectionId: string) => {
            let folderPath: string | null = null;
            
            // Tauri mode: use native pick_folder command
            try {
              const { isTauriEnv, tryInvoke } = await import("./lib/tauri");
              if (isTauriEnv()) {
                folderPath = await tryInvoke<string | null>("pick_folder", {});
              }
            } catch {}
            
            // Browser fallback
            if (!folderPath) {
              folderPath = await new Promise<string | null>((resolve) => {
                const input = document.createElement("input");
                input.type = "file";
                (input as any).webkitdirectory = true;
                (input as any).directory = true;
                input.style.display = "none";
                document.body.appendChild(input);
                input.addEventListener("change", () => {
                  const file = input.files?.[0];
                  if (file) {
                    resolve(file.webkitRelativePath.split("/")[0]);
                  } else {
                    resolve(null);
                  }
                  document.body.removeChild(input);
                });
                input.addEventListener("cancel", () => {
                  document.body.removeChild(input);
                  resolve(null);
                });
                input.click();
              });
            }
            
            if (folderPath) {
              await linkCollectionFolder(collectionId, folderPath);
              // Async: build folder index in background
              try {
                const { isTauriEnv, tryInvoke } = await import("./lib/tauri");
                if (isTauriEnv()) {
                  // Fire and forget - index builds in background
                  tryInvoke("build_folder_index", { path: folderPath }).catch(() => {});
                }
              } catch {}
            }
          }}
          onUnlinkFolder={async (collectionId: string) => {
            await unlinkCollectionFolder(collectionId);
          }}
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

        {/* Editor / Final Page */}
        {showFinalPage && activeArticleId ? (
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
                setActiveCollectionId(targetId);
                setHasActiveArticle(true);
              }
              return;
            }
            // No collectionId: open DocPicker
            setDocPickerOpen(true);
          }}
          onPlanComplete={handlePlanComplete}
          onEnterEditor={handleEnterEditor}
          onToggleFocus={() => setFocusMode(f => !f)}
          onToggleSidebar={() => setSidebarOpen(o => !o)}          onSaveStateChange={setSaveState}
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
          onToggleStylePanel={() => { closePanel(); setStylePanelOpen(o => !o); }}
          onCloseStylePanel={() => setStylePanelOpen(false)}
        />

        )}
        {/* Agent Panel */}
        <AgentPanel />
        {/* Style Panel */}
        <StylePanel
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
          { id: "toggle-focus", label: focusMode ? "退出焦点模式" : "进入焦点模式", icon: null, shortcut: "⌘⇧F", action: () => { setFocusMode(f => !f); setCommandPaletteOpen(false); } },
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
            window.dispatchEvent(new CustomEvent("plan-series-saved", { detail: { collectionId: seriesPlannerColId } }));
            setSeriesRefreshKey(k => k + 1);
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

export default function App() {
  return (
    <AgentProvider>
      <AppContent />
    </AgentProvider>
  );
}

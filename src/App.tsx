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
import { saveBlueprint, createDefaultBlueprint, type ArticleBlueprint, type OutlineSection } from "./lib/articleBlueprint";
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
import { loadCollections, addCollection, addArticle, renameArticle,
  linkCollectionFolder, unlinkCollectionFolder,
} from "./lib/collections";

import { saveArticleContent } from "./lib/articles";
import { useAgent } from "./lib/agent";
import { getProviders } from "./lib/providerModels";

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
  const [sidebarWidth, setSidebarWidth] = useState(264);
  const [resizing, setResizing] = useState<"sidebar" | null>(null);
  const [hasActiveArticle, setHasActiveArticle] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
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
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([]);
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [articlePhase, setArticlePhase] = useState<string | undefined>(undefined);
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
    // Create article
    const article = await addArticle(targetId, plan.title || "无标题");
    if (!article) return null;
    // Save blueprint with writing phase
    const bp = createDefaultBlueprint(plan.title || "无标题");
    bp.workingTitle = plan.title || "无标题";
    bp.description = plan.description || "";
    bp.tone = plan.tone || undefined;
    bp.targetAudience = plan.targetAudience || undefined;
    bp.targetWordCount = plan.targetWordCount || undefined;
    bp.tags = plan.tags || [];
    bp.outline = plan.outline || [];
    bp.phase = "writing";
    await saveBlueprint(article.id, bp);
    // Build article content skeleton from outline structure
    let doc = "# " + (plan.title || "无标题");
    if (plan.description) {
      doc += "\n\n> " + plan.description + "\n";
    }
    if (plan.outline && plan.outline.length > 0) {
      doc += "\n";
      for (const section of plan.outline) {
        const heading = "#".repeat(Math.min(section.level + 1, 4));
        doc += heading + " " + section.title + "\n\n\n";
      }
    }
    await saveArticleContent(article.id, doc);
    window.dispatchEvent(new CustomEvent("collections-changed"));
    return { articleId: article.id, collectionId: targetId };
  }, []);

  const handleEnterEditor = useCallback((articleId: string, collectionId: string) => {
    setActiveArticleId(articleId);
    setActiveCollectionId(collectionId);
    setHasActiveArticle(true);
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
    // Scroll editor to heading
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

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
      if (e.key === "Escape") {
        setThemePickerOpen(false);
        setSettingsOpen(false);
        setCommandPaletteOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Layout class
  const { panelOpen, closePanel } = useAgent();
  const layoutClass = [
    "layout",
    sidebarOpen ? "layout--sidebar-open" : "",
    panelOpen ? "layout--ai-open" : "",
    stylePanelOpen ? "layout--style-open" : "",
    resizing ? "layout--resizing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ErrorBoundary name="app">
    <div className="app">
      <div
        ref={layoutRef}
        className={layoutClass}
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
            "--ai-dock-width": sidebarOpen ? "420px" : "420px",
          } as React.CSSProperties
        }
      >
        {/* Sidebar */}
        <Sidebar
          onOpenSettings={openSettings}
          onSelectArticle={async (id) => {
            setActiveArticleId(id);
            setHasActiveArticle(true);
            const cols = await loadCollections();
            for (const c of cols) {
              if (c.articles.some(a => a.id === id)) {
                setActiveCollectionId(c.id);
                break;
              }
            }
          }}
          activeArticleId={activeArticleId}
          activeCollectionId={activeCollectionId}
          onNewArticle={async () => {
            // Navigate to welcome/start page (StartupSplash)
            setActiveArticleId(null);
            setActiveCollectionId(null);
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

        {/* Editor */}
        <EditorPane
          aiDockOpen={false}
          onToggleAIDock={() => {}}
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
          onToggleStylePanel={() => { closePanel(); setStylePanelOpen(o => !o); }}
          onCloseStylePanel={() => setStylePanelOpen(false)}
        />

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
          codeThemeId={codeThemeId}          onSetEditorMaxWidth={setEditorMaxWidth}
          editorParagraphGap={editorParagraphGap}
          onSetEditorParagraphGap={setEditorParagraphGap}
          editorFontFamily={editorFontFamily}
          onSetEditorFontFamily={setEditorFontFamily}
          codeThemeId={codeThemeId}
          onSetCodeTheme={setCodeThemeId}
          onApplyHeadingNumbers={handleApplyHeadingNumbers}
        />
      </div>

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

import { useMemo } from "react";
import { Sidebar } from "../components/sidebar/Sidebar";
import { EditorPane } from "../components/editor/EditorPane";
import { AgentPanel } from "../components/agent/AgentPanel";
import { ThemePicker } from "../components/settings/ThemePicker";
import { SettingsPanel } from "../components/settings";
import { StylePanel } from "../components/settings/StylePanel";
import { ToastContainer } from "../components/common/Toast";
import { StatusBar} from "../components/common/StatusBar";
import { ProjectExplorer } from "../components/common/ProjectExplorer";
import { ArticleManager } from "../components/collections/ArticleManager";
import { DocPicker } from "../components/collections/DocPicker";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { CommandPalette } from "../components/common/CommandPalette";
import { SeriesPlanner } from "../components/series/SeriesPlanner";
import { ArticleFinalPage } from "../components/editor/ArticleFinalPage";
import { genId, loadCollections, addCollection, addArticle,
  saveSeriesPlan, type SeriesPlan } from "../lib/storage/collections";
import { loadBlueprint } from "../lib/ai/articleBlueprint";
import { useAgent } from "../lib/ai/agent";
import { useThemeHandlers, useSeriesEventListeners } from "../hooks/appHooks";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { usePanelManager } from "../hooks/usePanelManager";
import { useOutlineNavigation } from "../hooks/useOutlineNavigation";
import { useArticleLifecycle } from "../hooks/useArticleLifecycle";
import { emit } from "../lib/events/eventBus";
import { ArticleContext, ArticleCtx } from "../lib/article/ArticleContext";
import { useThemeStore } from "../store/themeStore";
import { useEditorStore } from "../store/editorStore";
import { usePanelStore } from "../store/panelStore";
import { useArticleStore } from "../store/articleStore";

export default function MainEditorPage() {
  // ── Theme store ──
  const themeStyle = useThemeStore((s) => s.themeStyle);
  const themeMode = useThemeStore((s) => s.themeMode);
  const textSize = useThemeStore((s) => s.textSize);
  const fontFamily = useThemeStore((s) => s.fontFamily);

  // ── Editor store ──
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

  // ── Panel store (reads) ──
  const themePickerOpen = usePanelStore((s) => s.themePickerOpen);
  const settingsOpen = usePanelStore((s) => s.settingsOpen);
  const settingsTab = usePanelStore((s) => s.settingsTab);
  const sidebarOpen = usePanelStore((s) => s.sidebarOpen);
  const commandPaletteOpen = usePanelStore((s) => s.commandPaletteOpen);
  const focusMode = usePanelStore((s) => s.focusMode);
  const sidebarWidth = usePanelStore((s) => s.sidebarWidth);
  const resizing = usePanelStore((s) => s.resizing);
  const manageOpen = usePanelStore((s) => s.manageOpen);
  const docPickerOpen = usePanelStore((s) => s.docPickerOpen);
  const projectPanelOpen = usePanelStore((s) => s.projectPanelOpen);
  const stylePanelOpen = usePanelStore((s) => s.stylePanelOpen);
  const seriesPlannerOpen = usePanelStore((s) => s.seriesPlannerOpen);
  const setThemePickerOpen = usePanelStore((s) => s.setThemePickerOpen);
  const setSettingsOpen = usePanelStore((s) => s.setSettingsOpen);
  const setSidebarOpen = usePanelStore((s) => s.setSidebarOpen);
  const setCommandPaletteOpen = usePanelStore((s) => s.setCommandPaletteOpen);
  const setFocusMode = usePanelStore((s) => s.setFocusMode);
  const setManageOpen = usePanelStore((s) => s.setManageOpen);
  const setDocPickerOpen = usePanelStore((s) => s.setDocPickerOpen);
  const setStylePanelOpen = usePanelStore((s) => s.setStylePanelOpen);
  const setSeriesPlannerOpen = usePanelStore((s) => s.setSeriesPlannerOpen);
  const setProjectPanelOpen = usePanelStore((s) => s.setProjectPanelOpen);

  // ── Article store (reads) ──
  const saveState = useArticleStore((s) => s.saveState);
  const articlePhase = useArticleStore((s) => s.articlePhase);
  const hasActiveArticle = useArticleStore((s) => s.hasActiveArticle);
  const showFinalPage = useArticleStore((s) => s.showFinalPage);
  const seriesRefreshKey = useArticleStore((s) => s.seriesRefreshKey);
  const activeOutlineId = useArticleStore((s) => s.activeOutlineId);
  const activeCollectionId = useArticleStore((s) => s.activeCollectionId);
  const seriesPlannerColId = useArticleStore((s) => s.seriesPlannerColId);
  const seriesPlannerColTitle = useArticleStore((s) => s.seriesPlannerColTitle);
  const seriesPlannerFolder = useArticleStore((s) => s.seriesPlannerFolder);
  const seriesPlannerExistingPlan = useArticleStore((s) => s.seriesPlannerExistingPlan);
  const setSeriesPlannerColId = useArticleStore((s) => s.setSeriesPlannerColId);
  const incSeriesRefreshKey = useArticleStore((s) => s.incSeriesRefreshKey);
  const setSaveState = useArticleStore((s) => s.setSaveState);
  const setActiveCollectionId = useArticleStore((s) => s.setActiveCollectionId);
  const setSeriesPlannerExistingPlan = useArticleStore((s) => s.setSeriesPlannerExistingPlan);
  const setHasActiveArticle = useArticleStore((s) => s.setHasActiveArticle);
  const setShowFinalPage = useArticleStore((s) => s.setShowFinalPage);

  // ── Hooks ──
  const { handleSelectStyle, handleSelectMode, handleSelectTextSize, handleSelectFontFamily } = useThemeHandlers();
  const {
    setActiveArticleId,
    handleOpenArticle,
    handleBackToEdit,
    handleEnterEditor,
    handleApplyHeadingNumbers,
    handleDocPickerResult,
    handlePhaseChange,
    handlePlanComplete,
    applyHeadingNumbersRef,
    pendingSeriesArticleRef,
    styleReady,
    activeArticleId,
  } = useArticleLifecycle();
  const { openSettings, startResize, layoutRef } = usePanelManager();
  const { outlineItems, handleOutlineChange, handleOutlineSelect } = useOutlineNavigation();
  const { panelOpen, closePanel } = useAgent();

  useKeyboardShortcuts();
  useSeriesEventListeners(pendingSeriesArticleRef);

  const layoutClass = [
    "layout",
    sidebarOpen ? "layout--sidebar-open" : "",
    resizing ? "layout--resizing" : "",
    focusMode ? "layout--focus" : "",
  ].filter(Boolean).join(" ");

  const articleCtx = useMemo(
    () => (activeArticleId ? new ArticleContext(activeArticleId) : null),
    [activeArticleId],
  );

  return (
    <ErrorBoundary name="app">
    <div className={"app" + (focusMode ? " app--focus" : "")}>
      <div ref={layoutRef} className={layoutClass}
        style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
      >
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
            const bp = await loadBlueprint(id);
            setShowFinalPage(bp?.phase === "complete");
          }}
          activeArticleId={activeArticleId}
          onNewArticle={async () => {
            closePanel();
            setStylePanelOpen(false);
            setShowFinalPage(false);
            setProjectPanelOpen(false);
            setActiveArticleId(null);
            setActiveCollectionId(null);
            setHasActiveArticle(false);
          }}
          onNewArticleInCollection={async (collectionId: string) => {
            closePanel();
            setStylePanelOpen(false);
            setShowFinalPage(false);
            setProjectPanelOpen(false);
            setActiveArticleId(null);
            setActiveCollectionId(collectionId);
            setHasActiveArticle(false);
            emit('reset-plan');
          }}
          onManageArticles={() => setManageOpen(true)}
          outlineItems={outlineItems}
          activeOutlineId={activeOutlineId ?? undefined}
          onOutlineSelect={handleOutlineSelect}
        />
        <button className="sidebar-resizer"
          onPointerDown={startResize("sidebar")}
          role="separator" aria-orientation="vertical" aria-label="调整侧栏宽度"
        />
        <ArticleCtx.Provider value={articleCtx}>
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
              const cols = await loadCollections();
              const targetId = collectionId || (cols.length > 0 ? cols[0].id : (await addCollection("默认合集")).id);
              const article = await addArticle(targetId, "无标题");
              if (article) {
                setActiveArticleId(article.id);
                setActiveCollectionId(targetId);
                setHasActiveArticle(true);
              }
              return;
            }
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
        {panelOpen && (
          <div className="floating-layer">
            <div className="floating-layer__backdrop" onClick={closePanel} />
            <div className="floating-layer__panel">
              <AgentPanel />
            </div>
          </div>
        )}
        {stylePanelOpen && (
          <div className="floating-layer">
            <div className="floating-layer__backdrop" onClick={() => setStylePanelOpen(false)} />
            <div className="floating-layer__panel">
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
            </div>
          </div>
        )}
      </ArticleCtx.Provider>
      </div>

      {focusMode && (
        <button className="focus-exit-btn"
          onClick={() => setFocusMode(false)}
          title="退出焦点模式 (Esc)"
        >Exit Focus</button>
      )}
      <StatusBar saveState={saveState} phase={articlePhase} />
      <ThemePicker
        currentStyle={themeStyle} currentMode={themeMode}
        open={themePickerOpen} onClose={() => setThemePickerOpen(false)}
        onSelectStyle={handleSelectStyle} onSelectMode={handleSelectMode}
      />
      <SettingsPanel
        open={settingsOpen} initialTab={settingsTab}
        currentStyle={themeStyle} currentTheme={themeMode}
        currentTextSize={textSize} currentFontFamily={fontFamily}
        currentEditorFormat={editorFormat} currentEditorLineHeight={editorLineHeight}
        onClose={() => setSettingsOpen(false)}
        onSelectStyle={handleSelectStyle} onSelectTheme={handleSelectMode}
        onSelectTextSize={handleSelectTextSize} onSelectFontFamily={handleSelectFontFamily}
        onSetEditorFormat={setEditorFormat} onSetEditorLineHeight={setEditorLineHeight}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        extraCommands={[
          { id: "toggle-focus", label: focusMode ? "退出焦点模式" : "进入焦点模式", icon: null, shortcut: "⌘⇧F", action: () => { setFocusMode(!focusMode); setCommandPaletteOpen(false); } },
        ]}
      />
      <DocPicker
        open={docPickerOpen}
        onClose={() => setDocPickerOpen(false)}
        onResult={handleDocPickerResult}
        activeCollectionId={activeCollectionId}
      />
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
      <ToastContainer />
    </div>
    </ErrorBoundary>
  );
}

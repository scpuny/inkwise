import { useState, useCallback, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { EditorPane } from "./components/EditorPane";
import { AIDock } from "./components/AIDock";
import { ThemePicker } from "./components/ThemePicker";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusBar } from "./components/StatusBar";
import type { SettingsTab } from "./components/SettingsPanel";
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
import {
  addCollection,
  addArticle,
} from "./lib/collections";
import { getProviders } from "./lib/providerModels";

export default function App() {
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>(getThemeStyle());
  const [themeMode, setThemeMode] = useState<Theme>(getTheme());
  const [textSize, setTextSize] = useState<TextSize>(getTextSize());
  const [fontFamily, setFontFamily] = useState<FontFamily>(getFontFamily());
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("appearance");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiDockOpen, setAiDockOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(264);
  const [aiDockWidth, setAiDockWidth] = useState(420);
  const [resizing, setResizing] = useState<"sidebar" | "dock" | null>(null);
  const [hasActiveArticle, setHasActiveArticle] = useState(false);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [editorFormat, setEditorFormat] = useState<"rich" | "markdown">("rich");
  const [editorLineHeight, setEditorLineHeight] = useState(1.75);
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([]);
  const [activeOutlineId, setActiveOutlineId] = useState<string | null>(null);
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

  // Settings openers
  const openAppearance = useCallback(() => {
    setSettingsTab("appearance");
    setSettingsOpen(true);
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
    (type: "sidebar" | "dock") => (e: React.PointerEvent) => {
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
      } else if (resizing === "dock") {
        const dockRight = rect.width;
        const w = Math.max(320, Math.min(660, dockRight - x));
        setAiDockWidth(w);
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
      if (ctrl && e.key === "k") {
        e.preventDefault();
        (document.querySelector<HTMLElement>(".composer__input"))?.focus();
      }
      if (ctrl && e.key === "\\" && !e.shiftKey) {
        e.preventDefault();
        setSidebarOpen((o) => !o);
      }
      if (ctrl && e.shiftKey && e.key === "\\") {
        e.preventDefault();
        setAiDockOpen((o) => !o);
      }
      if (ctrl && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      if (e.key === "Escape") {
        setThemePickerOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Layout class
  const layoutClass = [
    "layout",
    sidebarOpen ? "layout--sidebar-open" : "",
    aiDockOpen ? "layout--ai-open" : "",
    resizing ? "layout--resizing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app">
      <div
        ref={layoutRef}
        className={layoutClass}
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
            "--ai-dock-width": `${aiDockWidth}px`,
          } as React.CSSProperties
        }
      >
        {/* Sidebar */}
        <Sidebar
          onOpenSettings={openSettings}
          onSelectArticle={(id) => { setActiveArticleId(id); setHasActiveArticle(true); }}
          onNewDoc={() => setHasActiveArticle(true)}
          activeArticleId={activeArticleId}
          onNewArticle={async () => {
            const cols = await (await import("./lib/collections")).loadCollections();
            const targetId = cols.length > 0 ? cols[0].id : (await addCollection("默认合集")).id;
            const article = await addArticle(targetId, "新文章");
            if (article) {
              setActiveArticleId(article.id);
              setHasActiveArticle(true);
            }
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
          aiDockOpen={aiDockOpen}
          onToggleAIDock={() => setAiDockOpen((o) => !o)}
          hasActiveArticle={hasActiveArticle}
          activeArticleId={activeArticleId}
          onNewDoc={() => setHasActiveArticle(true)}
          editorMode={editorFormat}
          editorLineHeight={editorLineHeight}
          onSetEditorFormat={setEditorFormat}
          onSetEditorLineHeight={setEditorLineHeight}
          onOutlineChange={handleOutlineChange}
        />

        {/* Dock Resizer */}
        <button
          className="dock-resizer"
          onPointerDown={startResize("dock")}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整 AI 面板宽度"
        />

        {/* AI Dock */}
        {aiDockOpen && <AIDock />}
      </div>

      {/* Status bar (full-width bottom) */}
      <StatusBar />

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
    </div>
  );
}

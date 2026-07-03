// SettingsPanel.tsx — 设置面板主容器：标签导航 + 按需渲染各设置页面
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { X, Settings, FileText, Cpu, Keyboard, Globe, Info, Sparkles } from "lucide-react";
import type { SettingsTab } from "./settingsHelpers";
import { SettingsPage, SettingsSection, SettingsField } from "./SettingsPageLayout";
import { ModelsSection } from "./ModelsSection";
import { PlatformsSection } from "./PlatformsSection";
import { GeneralSection } from "./GeneralSection";
import { EditorSection } from "./EditorSection";
import { ShortcutsSection } from "./ShortcutsSection";
import { SkillsSection } from "./SkillsSection";
import { ThemesSection } from "./ThemesSection";
import { WritingStylesSection } from "./WritingStylesSection";
import { AboutSection } from "./AboutSection";

const TABS: { id: SettingsTab; icon: ReactNode; label: string }[] = [
  { id: "general", icon: <Settings size={14} />, label: "通用" },
  { id: "editor",    icon: <FileText size={14} />,      label: "编辑器" },
  { id: "models",    icon: <Cpu size={14} />,      label: "模型" },
  { id: "shortcuts", icon: <Keyboard size={14} />, label: "快捷键" },
  { id: "themes",    icon: <FileText size={14} />,      label: "文章主题" },
  { id: "platforms", icon: <Globe size={14} />,     label: "发布平台" },
  { id: "styles",    icon: <Sparkles size={14} />,   label: "写作风格" },
  { id: "about",     icon: <Info size={14} />,      label: "关于" },
];

/* ─── Props ─── */
import type { ThemeStyle, Theme } from "../../lib/theme/theme";
import type { TextSize } from "../../lib/theme/textSize";
import type { FontFamily } from "../../lib/theme/fontFamily";

export type SettingsProps = {
  open: boolean;
  initialTab?: SettingsTab;
  onClose: () => void;
  currentStyle: ThemeStyle;
  currentTheme: Theme;
  currentTextSize: TextSize;
  currentFontFamily: FontFamily;
  onSelectStyle: (s: ThemeStyle) => void;
  onSelectTheme: (t: Theme) => void;
  onSelectTextSize: (s: TextSize) => void;
  onSelectFontFamily: (f: FontFamily) => void;
  currentEditorFormat?: "rich" | "markdown";
  currentEditorLineHeight?: number;
  onSetEditorFormat?: (f: "rich" | "markdown") => void;
  onSetEditorLineHeight?: (h: number) => void;
};

export function SettingsPanel({
  open, initialTab, onClose,
  currentStyle, currentTheme, currentTextSize, currentFontFamily,
  onSelectStyle, onSelectTheme, onSelectTextSize, onSelectFontFamily,
  currentEditorFormat = "rich",
  currentEditorLineHeight = 1.75,
  onSetEditorFormat,
  onSetEditorLineHeight: onSetLineHeight,
}: SettingsProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? "general");

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  if (!open) return null;

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <header className="settings-modal__head">
          <div className="settings-modal__title">设置</div>
          <button className="settings-modal__close" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </header>

        <div className="settings-body">
          <nav className="settings-nav" aria-label="设置分类">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`settings-nav__item${tab === t.id ? " settings-nav__item--active" : ""}`}
                onClick={() => setTab(t.id)}
              >{t.icon}<span>{t.label}</span></button>
            ))}
          </nav>

          <main className="settings-content">
            {tab === "general" && (
              <GeneralSection
                currentStyle={currentStyle} currentTheme={currentTheme}
                currentTextSize={currentTextSize} currentFontFamily={currentFontFamily}
                onSelectStyle={onSelectStyle} onSelectTheme={onSelectTheme}
                onSelectTextSize={onSelectTextSize} onSelectFontFamily={onSelectFontFamily}
              />
            )}
            {tab === "editor" && (
              <EditorSection
                currentFormat={currentEditorFormat}
                currentLineHeight={currentEditorLineHeight}
                onSetFormat={onSetEditorFormat}
                onSetLineHeight={onSetLineHeight}
              />
            )}
            {tab === "models" && <ModelsSection />}
            {tab === "shortcuts" && <ShortcutsSection />}
            {tab === "styles" && <WritingStylesSection />}
            {tab === "themes" && <ThemesSection />}
            {tab === "platforms" && <PlatformsSection />}
            {tab === "about" && <AboutSection />}
          </main>
        </div>
      </div>
    </div>
  );
}

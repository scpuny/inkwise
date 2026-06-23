import { useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import {
  Palette, FileText, Cpu, Keyboard, Info, X, Zap, Globe,
  Edit3, Languages, Maximize2, Search, PenTool, ListChecks,
  RotateCw, BookOpen, Hash, MessageSquare, Quote,
  Monitor, Sun, Plus, Trash2, Check, Sparkles, ChevronDown, ChevronRight,
} from "lucide-react";
import type { ThemeStyle, Theme } from "../lib/theme";
import { THEME_STYLES } from "../lib/theme";
import type { TextSize } from "../lib/textSize";
import { TEXT_SIZES } from "../lib/textSize";
import type { FontFamily } from "../lib/fontFamily";
import { FONT_FAMILIES, applyFontFamily, getCustomFontName, setCustomFontName } from "../lib/fontFamily";
import { type Provider, BUILTIN_PROVIDERS, getProvidersSync, saveProvidersSync, defaultModels } from "../lib/providerModels";
import { getAllThemes, getThemeById, isPresetTheme, saveCustomThemes, loadCustomThemes, type ArticleTheme, type ArticleThemeVars } from "../lib/articleThemes";
import { InlineConfirmButton } from "./InlineConfirmButton";
import type { Skill } from "../lib/skill";
import { isTauriEnv, tryInvoke } from "../lib/tauri";
import { getPlatformConfigs, savePlatformConfig, deletePlatformConfig, verifyPlatformCredentials } from "../lib/platforms";
import type { PlatformConfig } from "../lib/platforms";

// Skill icons & labels (shared with InlineToolbar/AgentPanel)
const SKILL_ICONS: Record<string, ReactNode> = {
  "polish": <Sparkles size={13} />,
  "rewrite": <Edit3 size={13} />,
  "translate": <Languages size={13} />,
  "expand": <Maximize2 size={13} />,
  "analysis": <Search size={13} />,
  "continue-writing": <PenTool size={13} />,
  "proofread": <ListChecks size={13} />,
  "summary": <FileText size={13} />,
  "outline": <ListChecks size={13} />,
  "paraphrase": <RotateCw size={13} />,
  "academic": <BookOpen size={13} />,
  "creative": <PenTool size={13} />,
  "headline": <Hash size={13} />,
  "keyword-extract": <Search size={13} />,
  "readability": <MessageSquare size={13} />,
  "citation": <Quote size={13} />,
  "blog": <FileText size={13} />,
  "novel": <BookOpen size={13} />,
  "email": <MessageSquare size={13} />,
};
const SKILL_LABELS: Record<string, string> = {
  "continue-writing":"续写","rewrite":"改写","polish":"润色","translate":"翻译",
  "academic":"学术写作","creative":"创意写作","summary":"摘要","outline":"大纲",
  "expand":"扩写","paraphrase":"同义改写","proofread":"校对",
  "blog":"博客","novel":"小说","headline":"标题","email":"邮件",
  "keyword-extract":"关键词","readability":"可读性","citation":"引用",
};
const PRIMARY_SKILLS = ["polish","rewrite","translate","expand","analysis"];


/* ─── Tab definitions ─── */
export type SettingsTab = "appearance" | "editor" | "models" | "shortcuts" | "skills" | "themes" | "platforms" | "about";

const TABS: { id: SettingsTab; icon: ReactNode; label: string }[] = [
  { id: "appearance", icon: <Palette size={14} />, label: "外观" },
  { id: "editor",    icon: <FileText size={14} />, label: "编辑器" },
  { id: "models",    icon: <Cpu size={14} />,      label: "模型" },
  { id: "shortcuts", icon: <Keyboard size={14} />, label: "快捷键" },
  { id: "skills",    icon: <Zap size={14} />,       label: "技能" },
  { id: "themes",    icon: <FileText size={14} />,    label: "文章主题" },
  { id: "platforms", icon: <Globe size={14} />,     label: "发布平台" },
  { id: "about",     icon: <Info size={14} />,      label: "关于" },
];

/* ─── Style helpers ─── */
const STYLE_LABELS: Record<ThemeStyle, string> = {
  graphite: "石墨",
  aurora: "极光",
  slate: "石板",
  carbon: "碳灰",
  nocturne: "夜曲",
  amber: "琥珀",
};
const STYLE_COLORS: Record<ThemeStyle, string> = {
  graphite: "linear-gradient(120deg,#ff6a3d,#ff9a52)",
  aurora: "linear-gradient(120deg,#8b7cff,#b07cff 42%,#38d6e6)",
  slate: "linear-gradient(120deg,#4d8df6,#3b82f6)",
  carbon: "linear-gradient(120deg,#2dd4bf,#22d3ee)",
  nocturne: "linear-gradient(120deg,#818cf8,#a78bfa)",
  amber: "linear-gradient(120deg,#d4632f,#de7a4b)",
};

/* ─── Props ─── */
export type SettingsProps = {
  open: boolean;
  initialTab?: SettingsTab;
  onClose: () => void;
  /* appearance */
  currentStyle: ThemeStyle;
  currentTheme: Theme;
  currentTextSize: TextSize;
  currentFontFamily: FontFamily;
  onSelectStyle: (s: ThemeStyle) => void;
  onSelectTheme: (t: Theme) => void;
  onSelectTextSize: (s: TextSize) => void;
  onSelectFontFamily: (f: FontFamily) => void;
  /* editor */
  currentEditorFormat?: "rich" | "markdown";
  currentEditorLineHeight?: number;
  onSetEditorFormat?: (mode: "rich" | "markdown") => void;
  onSetEditorLineHeight?: (h: number) => void;
};

/* ════════════════════════════════════════════════
   MAIN — SettingsPanel
   ════════════════════════════════════════════════ */
export function SettingsPanel({
  open, initialTab, onClose,
  currentStyle, currentTheme, currentTextSize, currentFontFamily,
  onSelectStyle, onSelectTheme, onSelectTextSize, onSelectFontFamily,
  currentEditorFormat = "rich",
  currentEditorLineHeight = 1.75,
  onSetEditorFormat,
  onSetEditorLineHeight,
}: SettingsProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? "appearance");

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
            {tab === "appearance" && (
              <AppearanceSection
                currentStyle={currentStyle} currentTheme={currentTheme}
                currentTextSize={currentTextSize} currentFontFamily={currentFontFamily}
                onSelectStyle={onSelectStyle} onSelectTheme={onSelectTheme}
                onSelectTextSize={onSelectTextSize} onSelectFontFamily={onSelectFontFamily}
              />
            )}
            {tab === "editor" && <EditorSection currentFormat={currentEditorFormat} currentLineHeight={currentEditorLineHeight} onSetFormat={onSetEditorFormat} onSetLineHeight={onSetEditorLineHeight} />}
            {tab === "models" && <ModelsSection />}
            {tab === "shortcuts" && <ShortcutsSection />}
            {tab === "skills" && <SkillsSection />}
            {tab === "themes" && <ThemesSection />}
            {tab === "platforms" && <PlatformsSection />}
            {tab === "about" && <AboutSection />}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   APPEARANCE SECTION — mirrors Reasonix
   ════════════════════════════════════════════════ */
function AppearanceSection({
  currentStyle, currentTheme, currentTextSize, currentFontFamily,
  onSelectStyle, onSelectTheme, onSelectTextSize, onSelectFontFamily,
}: {
  currentStyle: ThemeStyle; currentTheme: Theme;
  currentTextSize: TextSize; currentFontFamily: FontFamily;
  onSelectStyle: (s: ThemeStyle) => void; onSelectTheme: (t: Theme) => void;
  onSelectTextSize: (s: TextSize) => void; onSelectFontFamily: (f: FontFamily) => void;
}) {
  const [customFont, setCustomFont] = useState(getCustomFontName());
  const isCustom = currentFontFamily === "custom";

  const handleFontFamily = useCallback((f: FontFamily) => {
    onSelectFontFamily(f);
    if (f === "custom" && customFont.trim()) {
      setCustomFontName(customFont.trim());
      applyFontFamily("custom");
    }
  }, [onSelectFontFamily, customFont]);

  const handleCustomFontBlur = useCallback(() => {
    if (customFont.trim()) {
      setCustomFontName(customFont.trim());
      if (currentFontFamily === "custom") applyFontFamily("custom");
    }
  }, [customFont, currentFontFamily]);

  return (
    <SettingsPage title="外观" desc="自定义写作环境的视觉风格">
      {/* Theme Style */}
      <SettingsSection title="主题风格" desc="选择配色方向，同时支持深色/浅色模式">
        <div className="theme-card-grid">
          {THEME_STYLES.map((style) => {
            const selected = currentStyle === style;
            const tag = themeStyleTag(style);
            return (
              <button
                key={style}
                role="radio"
                aria-checked={selected}
                className={`theme-card${selected ? " theme-card--on" : ""}`}
                onClick={() => onSelectStyle(style)}
                data-theme-style={style}
              >
                <span className="theme-card__head">
                  <span className="theme-card__name">{STYLE_LABELS[style]}</span>
                  <span className="theme-card__tag">{tag}</span>
                </span>
                <span className="theme-card__swatches" data-theme-style-card={style}>
                  <span className="theme-card__swatch theme-card__swatch--bg" />
                  <span className="theme-card__swatch theme-card__swatch--surface" />
                  <span className="theme-card__swatch theme-card__swatch--accent" />
                </span>
                <span className="theme-card__desc">{themeStyleDesc(style)}</span>
                {selected && (
                  <span className="theme-card__check">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Theme Mode */}
      <SettingsSection title="主题模式" desc="跟随系统或手动选择">
        <div className="set-seg">
          {[
            { value: "auto" as Theme, icon: <Monitor size={14} />, label: "跟随系统" },
            { value: "dark" as Theme, icon: <MoonIcon size={14} />, label: "深色" },
            { value: "light" as Theme, icon: <Sun size={14} />, label: "浅色" },
          ].map((opt) => (
            <button
              key={opt.value}
              className={`set-seg__btn${currentTheme === opt.value ? " set-seg__btn--on" : ""}`}
              onClick={() => onSelectTheme(opt.value)}
            >{opt.icon}{opt.label}</button>
          ))}
        </div>
      </SettingsSection>

      {/* Text Size */}
      <SettingsSection title="字号" desc="控制界面文字大小">
        <div className="set-seg">
          {TEXT_SIZES.map((s) => (
            <button
              key={s}
              className={`set-seg__btn${currentTextSize === s ? " set-seg__btn--on" : ""}`}
              onClick={() => onSelectTextSize(s)}
            >{textSizeLabel(s)}</button>
          ))}
        </div>
      </SettingsSection>

      {/* Font Family */}
      <SettingsSection title="字体" desc="选择界面显示字体">
        <div className="set-seg">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f}
              className={`set-seg__btn${currentFontFamily === f ? " set-seg__btn--on" : ""}`}
              onClick={() => handleFontFamily(f)}
            >{fontFamilyLabel(f)}</button>
          ))}
        </div>
        {isCustom && (
          <div className="custom-font-input" style={{ marginTop: 10 }}>
            <input
              className="settings-text-input"
              type="text"
              placeholder="输入自定义字体名称…"
              value={customFont}
              onChange={(e) => setCustomFont(e.target.value)}
              onBlur={handleCustomFontBlur}
            />
          </div>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}

function MoonIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}

function textSizeLabel(s: TextSize): string {
  return { small: "小", default: "中", large: "大", xlarge: "特大" }[s] ?? s;
}
function fontFamilyLabel(f: FontFamily): string {
  return { system: "系统", yahei: "微软雅黑", pingfang: "苹方", noto: "Noto", serif: "衬线", custom: "自定义" }[f] ?? f;
}
function themeStyleTag(style: ThemeStyle): string {
  return { graphite: "默认", aurora: "冷调", slate: "商务", carbon: "科技", nocturne: "深邃", amber: "复古" }[style] ?? "";
}
function themeStyleDesc(style: ThemeStyle): string {
  return { graphite: "暖橙色调，纸墨感，适合通用写作", aurora: "紫蓝色调，沉稳专业，适合学术/商务", slate: "冷静理性，适合技术文档", carbon: "青绿色调，安静护眼，适合长时写作", nocturne: "靛紫色调，优雅深邃，适合创意写作", amber: "暖橙复古，适合随笔/博客" }[style] ?? "";
}

/* ════════════════════════════════════════════════
   EDITOR SECTION
   ════════════════════════════════════════════════ */
function EditorSection({ currentFormat = "rich", currentLineHeight = 1.75, onSetFormat, onSetLineHeight }: {
  currentFormat: "rich" | "markdown";
  currentLineHeight: number;
  onSetFormat?: (f: "rich" | "markdown") => void;
  onSetLineHeight?: (h: number) => void;
}) {
  const [format, setFormat] = useState(currentFormat);
  const [lineHeight, setLineHeight] = useState(currentLineHeight);
  const [autoSave] = useState(true);

  useEffect(() => { setFormat(currentFormat); }, [currentFormat]);
  useEffect(() => { setLineHeight(currentLineHeight); }, [currentLineHeight]);

  return (
    <SettingsPage title="编辑器" desc="调整编辑体验和文档格式">
      <SettingsSection title="写作偏好">
        <SettingsField label="默认格式">
          <div className="set-seg">
            <button className={`set-seg__btn${format === "markdown" ? " set-seg__btn--on" : ""}`} onClick={() => { setFormat("markdown"); onSetFormat?.("markdown"); }}>Markdown</button>
            <button className={`set-seg__btn${format === "rich" ? " set-seg__btn--on" : ""}`} onClick={() => { setFormat("rich"); onSetFormat?.("rich"); }}>富文本</button>
          </div>
        </SettingsField>
        <SettingsField label="行间距" hint="正文行高">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="range" min="1.2" max="2.4" step="0.05" value={lineHeight} onChange={(e) => { const v = Number(e.target.value); setLineHeight(v); onSetLineHeight?.(v); }} className="range-input" />
            <span className="range-value">{lineHeight.toFixed(2)}</span>
          </div>
        </SettingsField>
        <SettingsField label="自动保存">
          <label className="toggle">
            <input type="checkbox" checked={autoSave} className="toggle__input" readOnly />
            <span className="toggle__slider" />
          </label>
        </SettingsField>
      </SettingsSection>
      <SettingsSection title="段间距" desc="段落之间的垂直间距">
        <SettingsField label="段间距">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="range" min="0.5" max="2.5" step="0.25" defaultValue={1.25} className="range-input" />
            <span className="range-value">1.25em</span>
          </div>
        </SettingsField>
      </SettingsSection>
    </SettingsPage>
  );
}

/* ════════════════════════════════════════════════
   SHORTCUTS SECTION
   ════════════════════════════════════════════════ */
const SHORTCUT_GROUPS = [
  {
    title: "全局快捷键",
    items: [
      { label: "命令面板", keys: "Ctrl+K" },
      { label: "切换侧栏", keys: "Ctrl+\\" },
      { label: "切换 AI 面板", keys: "Ctrl+Shift+\\" },
      { label: "焦点模式", keys: "Ctrl+Shift+F" },
      { label: "打开设置", keys: "Ctrl+," },
      { label: "关闭面板/弹窗", keys: "Esc" },
    ],
  },
  {
    title: "编辑器",
    items: [
      { label: "新建文档", keys: "Ctrl+N" },
      { label: "保存", keys: "Ctrl+S" },
      { label: "查找替换", keys: "Ctrl+F" },
      { label: "撤销", keys: "Ctrl+Z" },
      { label: "重做", keys: "Ctrl+Shift+Z" },
      { label: "加粗", keys: "Ctrl+B" },
      { label: "斜体", keys: "Ctrl+I" },
    ],
  },
  {
    title: "AI 交互",
    items: [
      { label: "打开 AI 对话", keys: "Ctrl+K" },
      { label: "发送消息", keys: "Ctrl+Enter" },
      { label: "接受 AI 建议", keys: "Tab" },
      { label: "忽略 AI 建议", keys: "Esc" },
    ],
  },
  {
    title: "AI 技能",
    items: [
      { label: "润色", keys: "Alt+1" },
      { label: "改写", keys: "Alt+2" },
      { label: "翻译", keys: "Alt+3" },
      { label: "扩写", keys: "Alt+4" },
      { label: "分析", keys: "Alt+5" },
    ],
  },
];

const DEFAULT_SHORTCUTS = SHORTCUT_GROUPS.flatMap(g => g.items);

function ShortcutsSection() {
  return (
    <SettingsPage title="快捷键" desc="所有操作均可通过键盘完成">
      {SHORTCUT_GROUPS.map((group, gi) => (
        <div key={gi} style={{marginBottom: 16}}>
          <div style={{fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", padding: "8px 0 4px"}}>{group.title}</div>
          <div className="shortcuts-table">
            <div className="shortcuts-table__head"><span>操作</span><span>快捷键</span></div>
            {group.items.map((sc, i) => (
              <div key={i} className="shortcuts-table__row">
                <span>{sc.label}</span>
                <kbd className="shortcut-key">{sc.keys}</kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </SettingsPage>
  );
}
function SkillsSection() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // New skill form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formRunAs, setFormRunAs] = useState<"Inline" | "Subagent">("Inline");
  const [formTools, setFormTools] = useState<string[]>(["read_document"]);
  const [formBody, setFormBody] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formEffort, setFormEffort] = useState("");
  const [formGenerating, setFormGenerating] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const formNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { listSkills } = await import("../lib/skill");
        const list = await listSkills();
        setSkills(list);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const toggleSkill = async (name: string, enabled: boolean) => {
    try {
      const { setSkillEnabled } = await import("../lib/skill");
      await setSkillEnabled(name, enabled);
      setSkills(prev => prev.map(s => s.name === name ? { ...s, enabled } : s));
    } catch {}
  };

  const deleteSkillFn = async (name: string) => {
    try {
      const { deleteSkill } = await import("../lib/skill");
      await deleteSkill(name);
      setSkills(prev => prev.filter(s => s.name !== name));
    } catch {}
  };

  const toggleTool = (tool: string) => {
    setFormTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };

  const handleGenerateBody = async () => {
    if (!formName.trim() || !formDesc.trim()) return;
    setFormGenerating(true);
    try {
      const { generateSkillBody } = await import("../lib/skill");
      // Body is AI-generated, saved via installSkill
      setFormGenerating(false);
    } catch {
      setFormGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formDesc.trim()) return;
    setFormSaving(true);
    try {
      const { installSkill } = await import("../lib/skill");
      await installSkill(formName.trim(), formDesc.trim(), formBody.trim() || "", formRunAs);
      // Reload skills
      const { listSkills } = await import("../lib/skill");
      const list = await listSkills();
      setSkills(list);
      setShowEditor(false);
      // Reset form
      setFormName("");
      setFormDesc("");
      setFormRunAs("Inline");
      setFormTools(["read_document"]);
      setFormBody("");
      setFormModel("");
      setFormEffort("");
    } catch {}
    setFormSaving(false);
  };

  return (
    <SettingsPage title="技能" desc="管理 AI 写作技能，启用或禁用特定功能">
      {loading ? (
        <div style={{padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>加载中…</div>
      ) : (
        <>
        <div className="skills-list">
          {skills.map((s) => (
            <div key={s.name} className={"skills-list__item" + (expandedSkill === s.name ? " skills-list__item--expanded" : "")}>
              <div className="skills-list__header" onClick={() => setExpandedSkill(expandedSkill === s.name ? null : s.name)}>
                <span className="skills-list__chevron">
                  {expandedSkill === s.name ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
                <span className="skills-list__name">{SKILL_LABELS[s.name] || s.name}</span>
                <span className="skills-list__desc">{s.description}</span>
                <span className="skills-list__loc-badges">
                  {PRIMARY_SKILLS.includes(s.name) && <span className="skills-list__loc-badge" title="出现在选中文本快捷工具栏">工具栏</span>}
                  {SKILL_LABELS[s.name] ? (
                    <span className="skills-list__loc-badge" title="出现在 Chat 输入框快捷操作">快捷</span>
                  ) : (
                    !PRIMARY_SKILLS.includes(s.name) && <span className="skills-list__loc-badge" title="在更多面板中可用">更多</span>
                  )}
                </span>
                <button
                  className={"skills-list__toggle" + (s.enabled ? " skills-list__toggle--on" : "")}
                  onClick={(e) => { e.stopPropagation(); toggleSkill(s.name, !s.enabled); }}
                  title={s.enabled ? "禁用" : "启用"}
                >
                  <Check size={10} />
                </button>
              </div>
              {expandedSkill === s.name && (
                <div className="skills-list__body">
                  <div className="skills-list__preview">
                    <span className="skills-list__preview-icon">{SKILL_ICONS[s.name] || <Sparkles size={13} />}</span>
                    <span className="skills-list__preview-label">{SKILL_LABELS[s.name] || s.name}</span>
                  </div>
                  <div className="skills-list__meta">
                    <span className="skills-list__meta-key">执行方式</span>
                    <span className={"skills-list__badge skills-list__badge--" + (s.run_as?.toLowerCase() || "inline")}>
                      {s.run_as === "Subagent" ? "子代理" : "内联"}
                    </span>
                    <span className="skills-list__meta-hint">
                      {s.run_as === "Subagent" ? "适合复杂任务，独立推理执行" : "轻量快速，直接在对话中完成"}
                    </span>
                  </div>
                  {s.allowed_tools && s.allowed_tools.length > 0 && (
                    <div className="skills-list__meta">
                      <span className="skills-list__meta-key">工具权限</span>
                      <div className="skills-list__tags">
                        {s.allowed_tools.map(t => (
                          <span key={t} className="skills-list__tag">{{
                            "read_document": "读取文档", "write_document": "写入文档", "search_document": "搜索文档"
                          }[t] || t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(s.model || s.effort) && (
                    <div className="skills-list__meta">
                      <span className="skills-list__meta-key">模型配置</span>
                      <span className="skills-list__meta-val">
                        {s.model ? `模型: ${s.model}` : ""}
                        {s.model && s.effort ? " · " : ""}
                        {s.effort ? `推理力度: ${s.effort}` : ""}
                      </span>
                    </div>
                  )}
                  <div className="skills-list__meta">
                    <span className="skills-list__meta-key">出现位置</span>
                    <div className="skills-list__locations">
                      <span className={"skills-list__loc" + (PRIMARY_SKILLS.includes(s.name) ? " skills-list__loc--active" : "")}>
                        快捷工具栏 {PRIMARY_SKILLS.includes(s.name) && s.enabled ? "✓" : ""}
                      </span>
                      <span className={"skills-list__loc" + (!PRIMARY_SKILLS.includes(s.name) ? " skills-list__loc--active" : "")}>
                        更多面板 {!PRIMARY_SKILLS.includes(s.name) && s.enabled ? "✓" : ""}
                      </span>
                      <span className={"skills-list__loc" + (SKILL_LABELS[s.name] ? " skills-list__loc--active" : "")}>
                        Chat 快捷操作 {SKILL_LABELS[s.name] && s.enabled ? "✓" : ""}
                      </span>
                    </div>
                  </div>
                  {/* Body content for non-Builtin skills */}
                  {s.scope !== "Builtin" && s.body && (
                    <div className="skills-list__meta">
                      <span className="skills-list__meta-key">指令模板</span>
                      <pre className="skills-list__body-preview">{s.body.slice(0, 300)}{s.body.length > 300 ? "…" : ""}</pre>
                    </div>
                  )}
                  {/* Delete button for non-Builtin skills */}
                  {s.scope !== "Builtin" && (
                    <div className="skills-list__meta" style={{marginTop: 8}}>
                      <button className="btn btn--danger" onClick={() => deleteSkillFn(s.name)} style={{fontSize: 11, padding: "2px 10px"}}>
                        <Trash2 size={10} /> 删除此技能
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Skill Button */}
        <div style={{padding: "12px 0", textAlign: "center"}}>
          <button className="btn btn--primary" onClick={() => setShowEditor(true)} style={{fontSize: 12, padding: "6px 16px"}}>
            <Plus size={12} /> 新建技能
          </button>
        </div>

        {/* New Skill Editor Modal */}
        {showEditor && (
          <div className="settings-overlay" onClick={() => setShowEditor(false)}>
            <div className="settings-dialog" onClick={(e) => e.stopPropagation()} style={{maxWidth: 480}}>
              <div className="settings-dialog__header">
                <h3>新建技能</h3>
                <button className="settings-dialog__close" onClick={() => setShowEditor(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="settings-dialog__body" style={{display: "flex", flexDirection: "column", gap: 12}}>
                <SettingsField label="技能 ID">
                  <input className="settings-input" ref={formNameRef} value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="英文标识，如 my-polish" />
                </SettingsField>
                <SettingsField label="中文名称">
                  <input className="settings-input" value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="如：我的润色" />
                </SettingsField>
                <SettingsField label="描述">
                  <input className="settings-input" value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="技能的作用说明" />
                </SettingsField>
                <SettingsField label="指令模板（body）">
                  <textarea className="settings-textarea" value={formBody}
                    onChange={e => setFormBody(e.target.value)}
                    placeholder="技能的核心提示词，支持 Markdown 格式。留空则使用 AI 生成"
                    style={{minHeight: 80, resize: "vertical"}} />
                </SettingsField>
                <SettingsField label="执行方式">
                  <select className="settings-select" value={formRunAs}
                    onChange={e => setFormRunAs(e.target.value as any)}>
                    <option value="Inline">内联（轻量快速）</option>
                    <option value="Subagent">子代理（复杂独立推理）</option>
                  </select>
                </SettingsField>
                <SettingsField label="工具权限">
                  <div className="skills-list__tags">
                    {["read_document", "write_document", "search_document"].map(t => (
                      <label key={t} className="skills-list__tag" style={{cursor: "pointer",
                        background: formTools.includes(t) ? "var(--accent-soft)" : "var(--hover)",
                        color: formTools.includes(t) ? "var(--accent)" : "var(--text-secondary)",
                      }}>
                        <input type="checkbox" checked={formTools.includes(t)}
                          onChange={() => toggleTool(t)} style={{display: "none"}} />
                        {{"read_document": "读取", "write_document": "写入", "search_document": "搜索"}[t]}
                      </label>
                    ))}
                  </div>
                </SettingsField>
                <SettingsField label="模型（可选）">
                  <input className="settings-input" value={formModel}
                    onChange={e => setFormModel(e.target.value)}
                    placeholder="如 gpt-4o，留空使用默认" />
                </SettingsField>
                <SettingsField label="推理力度（可选）">
                  <select className="settings-select" value={formEffort}
                    onChange={e => setFormEffort(e.target.value)}>
                    <option value="">默认</option>
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </SettingsField>
              </div>
              <div className="settings-dialog__footer">
                <button className="btn" onClick={() => setShowEditor(false)} style={{fontSize: 12, padding: "6px 14px"}}>
                  取消
                </button>
                <button className="btn btn--primary" onClick={handleSave} disabled={!formName.trim() || formSaving}
                  style={{fontSize: 12, padding: "6px 14px"}}>
                  {formSaving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      )}
    </SettingsPage>
  );
}

function ThemesSection() {
  const themes = getAllThemes();
  const [customs, setCustoms] = useState<ArticleTheme[]>(loadCustomThemes());
  const [showEditor, setShowEditor] = useState(false);
  const [editTheme, setEditTheme] = useState<ArticleTheme | null>(null);

  const refresh = useCallback(() => {
    setCustoms(loadCustomThemes());
  }, []);

  const handleImportTheme = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        // Validate theme structure
        if (!data.label || !data.vars || !data.vars.textColor) {
          alert('无效的主题文件');
          return;
        }
        const theme: ArticleTheme = {
          id: 'custom-' + Date.now(),
          label: data.label,
          desc: data.desc || '导入的主题',
          platform: 'general',
          tags: ['自定义', '导入'],
          vars: data.vars,
        };
        const existing = loadCustomThemes();
        saveCustomThemes([...existing, theme]);
        refresh();
      } catch {
        alert('导入失败：文件格式错误');
      }
    };
    input.click();
  }, [refresh]);

  const defaultVars: ArticleThemeVars = {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '16',
    lineHeight: 1.75,
    paragraphGap: '1.25',
    maxWidth: '780',
    textColor: '#2c2c2c',
    bgColor: '#ffffff',
    headingColor: '#111111',
    linkColor: '#1a73e8',
    codeBg: '#f5f5f5',
    codeText: '#333333',
    blockquoteBorder: '#dfe1e5',
    blockquoteBg: '#f8f9fa',
  };

  return (
    <SettingsPage title="文章主题管理">
      <div className="settings-section__header">
        <h3 className="settings-section__title">文章主题</h3>
        <div style={{display: 'flex', gap: 6}}>
          <button className="btn btn--small" onClick={handleImportTheme}>
            <FileText size={12} /> 导入
          </button>
          <button className="btn btn--small" onClick={() => {
            setEditTheme(null);
            setShowEditor(true);
          }}>
            <Plus size={12} /> 新建
          </button>
        </div>
      </div>

      <div className="theme-manager__grid">
        {themes.map(t => {
          const isCustom = !isPresetTheme(t.id);
          const v = t.vars;
          return (
            <div key={t.id} className="theme-manager__card">
              <div className="theme-manager__card-preview" style={{background: v.bgColor}}>
                <div className="theme-manager__card-swatches">
                  <span className="theme-manager__swatch" style={{background: v.textColor}} title="文字色" />
                  <span className="theme-manager__swatch" style={{background: v.headingColor}} title="标题色" />
                  <span className="theme-manager__swatch" style={{background: v.linkColor}} title="链接色" />
                  <span className="theme-manager__swatch" style={{background: v.codeBg, border: '1px solid rgba(0,0,0,0.06)'}} title="代码背景" />
                  <span className="theme-manager__swatch" style={{background: v.blockquoteBorder}} title="引用边框" />
                </div>
                <div className="theme-manager__card-text" style={{color: v.headingColor, fontFamily: v.fontFamily}}>
                  <div style={{fontWeight: 700, fontSize: 14}}>{t.label}</div>
                  <div style={{fontSize: 10, color: v.textColor, marginTop: 2}}>{v.fontSize}px / {v.lineHeight}</div>
                </div>
              </div>
              <div className="theme-manager__card-info">
                <span className="theme-manager__card-name">{t.label}</span>
                {isCustom && <span className="theme-manager__card-badge">自定义</span>}
              </div>
              <div className="theme-manager__card-desc">{t.desc}</div>
              <div className="theme-manager__card-actions">
                {!isCustom && (
                  <button className="btn btn--small" onClick={() => { setEditTheme(t); setShowEditor(true); }}>复制创建</button>
                )}
                {isCustom && (
                  <>
                    <button className="btn btn--small" onClick={() => { setEditTheme(t); setShowEditor(true); }}>编辑</button>
                    <button className="btn btn--small" onClick={() => {
                      const json = JSON.stringify({ label: t.label, desc: t.desc, vars: t.vars }, null, 2);
                      const fileName = t.label + '.json';
                      if (isTauriEnv()) {
                        tryInvoke('dialog_save', { filters: [{ name: 'JSON', extensions: ['json'] }], defaultPath: fileName }).then((path: any) => {
                          if (path) tryInvoke('fs_write_text_file', { path, contents: json });
                        });
                      } else {
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = fileName;
                        document.body.appendChild(a); a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }
                    }}>导出</button>
                    <button className="btn btn--small btn--danger" onClick={() => {
                      const updated = customs.filter(c => c.id !== t.id);
                      saveCustomThemes(updated);
                      refresh();
                    }}>删除</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showEditor && (
        <div className="settings-overlay" onClick={() => setShowEditor(false)}>
          <div className="theme-editor" onClick={e => e.stopPropagation()}>
            <div className="theme-editor__header">
              <h4>{editTheme ? '编辑自定义主题' : '新建自定义主题'}</h4>
              <button className="btn btn--small" onClick={() => setShowEditor(false)}>✕</button>
            </div>
            <ThemeForm
              initial={editTheme || { id: '', label: '', desc: '', platform: 'general', tags: [], vars: { ...defaultVars } }}
              onSave={(theme) => {
                const existing = customs.filter(c => c.id !== theme.id);
                saveCustomThemes([...existing, theme]);
                refresh();
                setShowEditor(false);
              }}
              isNew={!editTheme}
            />
          </div>
        </div>
      )}
    </SettingsPage>
  );
}

function ThemeForm({ initial, onSave, isNew }: { initial: ArticleTheme; onSave: (t: ArticleTheme) => void; isNew: boolean }) {
  const [label, setLabel] = useState(initial.label);
  const [desc, setDesc] = useState(initial.desc);
  const [vars, setVars] = useState<ArticleThemeVars>({ ...initial.vars });

  const updateVar = (key: keyof ArticleThemeVars, val: any) => {
    setVars(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    if (!label.trim()) return;
    // Generate new ID for new/copy; keep original ID for editing existing custom
    const isEditingCustom = !isNew && initial.id.startsWith('custom-');
    const id = isEditingCustom ? initial.id : 'custom-' + Date.now();
    onSave({
      id,
      label: label.trim(),
      desc: desc.trim(),
      platform: 'general',
      tags: ['自定义'],
      vars,
    });
  };

  return (
    <div className="theme-editor__form">
      <div className="theme-editor__field-row">
        <div className="theme-editor__field">
          <label className="set-label">主题名称</label>
          <input className="mem-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="我的自定义主题" />
        </div>
      </div>
      <div className="theme-editor__field-row">
        <div className="theme-editor__field">
          <label className="set-label">描述</label>
          <input className="mem-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="简短描述这个主题的风格" />
        </div>
      </div>
      <div className="theme-editor__divider" />

      <div className="theme-editor__field-group">
        <label className="theme-editor__group-label">排版</label>
        <div className="theme-editor__field-row">
          <div className="theme-editor__field">
            <label className="set-label">正文字体</label>
            <input className="mem-input" value={vars.fontFamily} onChange={e => updateVar('fontFamily', e.target.value)} placeholder="font-family" />
          </div>
          <div className="theme-editor__field">
            <label className="set-label">字号 (px)</label>
            <input className="mem-input" type="number" min={12} max={24} value={parseInt(vars.fontSize)} onChange={e => updateVar('fontSize', String(e.target.value))} />
          </div>
        </div>
        <div className="theme-editor__field-row">
          <div className="theme-editor__field">
            <label className="set-label">行距</label>
            <input className="mem-input" type="number" min={1} max={3} step={0.05} value={vars.lineHeight} onChange={e => updateVar('lineHeight', parseFloat(e.target.value))} />
          </div>
          <div className="theme-editor__field">
            <label className="set-label">段间距 (em)</label>
            <input className="mem-input" type="number" min={0.5} max={3} step={0.1} value={parseFloat(vars.paragraphGap)} onChange={e => updateVar('paragraphGap', String(e.target.value))} />
          </div>
          <div className="theme-editor__field">
            <label className="set-label">最大宽度 (px)</label>
            <input className="mem-input" type="number" min={500} max={1200} value={parseInt(vars.maxWidth)} onChange={e => updateVar('maxWidth', String(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="theme-editor__divider" />
      <div className="theme-editor__field-group">
        <label className="theme-editor__group-label">颜色</label>
        <div className="theme-editor__field-row">
          <div className="theme-editor__field">
            <label className="set-label">背景色</label>
            <div className="theme-editor__color-row">
              <input type="color" value={vars.bgColor} onChange={e => updateVar('bgColor', e.target.value)} />
              <input className="mem-input" value={vars.bgColor} onChange={e => updateVar('bgColor', e.target.value)} />
            </div>
          </div>
          <div className="theme-editor__field">
            <label className="set-label">正文字色</label>
            <div className="theme-editor__color-row">
              <input type="color" value={vars.textColor} onChange={e => updateVar('textColor', e.target.value)} />
              <input className="mem-input" value={vars.textColor} onChange={e => updateVar('textColor', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="theme-editor__field-row">
          <div className="theme-editor__field">
            <label className="set-label">标题色</label>
            <div className="theme-editor__color-row">
              <input type="color" value={vars.headingColor} onChange={e => updateVar('headingColor', e.target.value)} />
              <input className="mem-input" value={vars.headingColor} onChange={e => updateVar('headingColor', e.target.value)} />
            </div>
          </div>
          <div className="theme-editor__field">
            <label className="set-label">链接色</label>
            <div className="theme-editor__color-row">
              <input type="color" value={vars.linkColor} onChange={e => updateVar('linkColor', e.target.value)} />
              <input className="mem-input" value={vars.linkColor} onChange={e => updateVar('linkColor', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="theme-editor__field-row">
          <div className="theme-editor__field">
            <label className="set-label">代码背景</label>
            <div className="theme-editor__color-row">
              <input type="color" value={vars.codeBg} onChange={e => updateVar('codeBg', e.target.value)} />
              <input className="mem-input" value={vars.codeBg} onChange={e => updateVar('codeBg', e.target.value)} />
            </div>
          </div>
          <div className="theme-editor__field">
            <label className="set-label">代码文字色</label>
            <div className="theme-editor__color-row">
              <input type="color" value={vars.codeText} onChange={e => updateVar('codeText', e.target.value)} />
              <input className="mem-input" value={vars.codeText} onChange={e => updateVar('codeText', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="theme-editor__field-row">
          <div className="theme-editor__field">
            <label className="set-label">引用边框色</label>
            <div className="theme-editor__color-row">
              <input type="color" value={vars.blockquoteBorder} onChange={e => updateVar('blockquoteBorder', e.target.value)} />
              <input className="mem-input" value={vars.blockquoteBorder} onChange={e => updateVar('blockquoteBorder', e.target.value)} />
            </div>
          </div>
          <div className="theme-editor__field">
            <label className="set-label">引用背景色</label>
            <div className="theme-editor__color-row">
              <input type="color" value={vars.blockquoteBg} onChange={e => updateVar('blockquoteBg', e.target.value)} />
              <input className="mem-input" value={vars.blockquoteBg} onChange={e => updateVar('blockquoteBg', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="theme-editor__actions">
        <button className="btn" onClick={() => onSave(initial)}>取消</button>
        <button className="btn btn--primary" onClick={handleSave} disabled={!label.trim()}>
          <Check size={12} /> 保存主题
        </button>
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <SettingsPage title="关于">
      <div className="about-card">
        <div className="about-card__logo">
          <img src="/inkwise-icon.svg" width="100" height="100" alt="InkWise" />
        </div>
        <h3>InkWise · 墨智</h3>
        <p className="about-card__version">版本 0.0.1</p>
        <p className="about-card__desc">基于 React + TypeScript + Vite 构建，UI 设计参考 Reasonix 风格。</p>
        <div className="about-card__tech">
          <span>React 19</span>
          <span>TypeScript 6</span>
          <span>Vite 6</span>
          <span>Lucide Icons</span>
        </div>
      </div>
    </SettingsPage>
  );
}

/* ════════════════════════════════════════════════
   REUSABLE HELPERS
   ════════════════════════════════════════════════ */

function SettingsPage({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h2 className="settings-page__title">{title}</h2>
        {desc && <p className="settings-page__desc">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function SettingsSection({ title, desc, children, actions }: { title: string; desc?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="settings-section">
      <div className="settings-section__head">
        <div>
          <div className="settings-section__title">{title}</div>
          {desc && <div className="settings-section__desc">{desc}</div>}
        </div>
        {actions && <div className="settings-section__actions">{actions}</div>}
      </div>
      <div className="settings-section__body">{children}</div>
    </section>
  );
}

function SettingsField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="settings-field">
      <div className="settings-field__copy">
        <div className="settings-field__label">{label}</div>
        {hint && <div className="settings-field__hint">{hint}</div>}
      </div>
      <div className="settings-field__control">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MODELS SECTION — exact Reasonix copy (adapted for mock backend)
   ═══════════════════════════════════════════════════════════════════ */

type ModelPickerOption = { ref: string; provider: string; model: string; keySet: boolean };

type ProviderAccessGroup = {
  id: string; label: string; description: string; builtIn: boolean;
  providers: Provider[]; apiKeyEnv: string; keySet: boolean; baseUrl: string; kind: string; models: string[];
};

type ProviderFetchResult = { kind: "ok" | "warn"; text: string };
type ProviderModelDraft = { providerName: string; candidates: string[]; selected: string[] };
type AddProviderMode = null | "official" | "custom";
type OfficialProviderKind = "deepseek" | "openai" | "anthropic";

/* ─── Helpers ─── */
function uniqueStrings(arr: string[]): string[] { return [...new Set(arr.filter(Boolean))]; }

function modelOptionFromRef(ref: string, providers: Provider[]): ModelPickerOption | null {
  if (!ref) return null;
  const [pid, ...rest] = ref.split("/");
  return { ref, provider: pid, model: rest.join("/"), keySet: !!providers.find((p) => p.id === pid)?.apiKey };
}

function modelOptionMeta(option: ModelPickerOption): string {
  return option.provider;
}

function providerAccessGroups(providers: Provider[]): ProviderAccessGroup[] {
  return providers.map((p) => ({
    id: p.id, label: p.label,
    description: `${p.kind} · ${p.baseUrl || "无地址"}`,
    builtIn: p.builtin, providers: [p],
    apiKeyEnv: p.id.toUpperCase() + "_API_KEY",
    keySet: !!p.apiKey, baseUrl: p.baseUrl ?? "", kind: p.kind, models: p.models,
  }));
}

/* ─── Helpers ─── */
function isLikelyChatModel(model: string): boolean {
  const lower = model.toLowerCase();
  const exclude = ["text-embedding","speech","tts","stt","whisper","embedding","moderation","rerank","dall","transcription"];
  return !exclude.some((t) => lower.includes(t));
}

function providerModelCandidates(current: string[], fetched: string[]): string[] {
  return uniqueStrings([...current, ...fetched]).filter(isLikelyChatModel);
}

function mergedFetchedProviderModels(current: string[], fetched: string[], opts: { preserveCurated?: boolean } = {}): string[] {
  return opts.preserveCurated && current.length > 0 ? current : uniqueStrings([...current, ...fetched]);
}

function providerDefaultModel(currentDefault: string, models: string[]): string {
  return currentDefault && models.includes(currentDefault) ? currentDefault : models[0] ?? "";
}

/* ─── ModelsSection ─── */
function ModelsSection() {
  const [subtab, setSubtab] = useState<"usage" | "access">("usage");
  const [providers, setProviders] = useState<Provider[]>(() => getProvidersSync());
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<AddProviderMode>(null);
  const [fetchingProvider, setFetchingProvider] = useState<string | null>(null);
  const [fetchResults, setFetchResults] = useState<Record<string, ProviderFetchResult>>({});
  const [modelDrafts, setModelDrafts] = useState<Record<string, ProviderModelDraft>>({});

  const handleSave = useCallback(async (updated: Provider[]) => { 
    setProviders(updated); 
    saveProvidersSync(updated);
    // Sync to Tauri backend
    try { await tryInvoke("set_providers", { providers: updated }); } catch { /* browser mode */ }
  }, []);

  const groups = providerAccessGroups(providers);

  const setGroupFetchResult = (groupID: string, result: ProviderFetchResult | null) => {
    setFetchResults((prev) => { const n = { ...prev }; if (result) n[groupID] = result; else delete n[groupID]; return n; });
  };
  const setGroupModelDraft = (groupID: string, draft: ProviderModelDraft | null) => {
    setModelDrafts((prev) => { const n = { ...prev }; if (draft) n[groupID] = draft; else delete n[groupID]; return n; });
  };

  const modelDraftForFetch = (name: string, currentModels: string[], fetched: string[]): ProviderModelDraft => {
    const candidates = providerModelCandidates(currentModels, fetched);
    const selected = mergedFetchedProviderModels(currentModels, fetched, { preserveCurated: true });
    return { providerName: name, candidates, selected: candidates.filter((m) => selected.includes(m)) };
  };

  const refreshModels = async (provider: Provider) => {
    setFetchingProvider(provider.id);
    setGroupFetchResult(provider.id, null);
    setGroupModelDraft(provider.id, null);
    try {
      const fetched = await tryInvoke<string[]>("fetch_models", { providerId: provider.id });
      if (!fetched || fetched.length === 0) {
        setGroupFetchResult(provider.id, { kind: "warn", text: `未获取到模型` });
        setFetchingProvider(null); return;
      }
      const draft = modelDraftForFetch(provider.id, provider.models, fetched);
      setGroupModelDraft(provider.id, draft);
      setGroupFetchResult(provider.id, { kind: "ok", text: `获取到 ${draft.candidates.length} 个模型候选` });
    } catch (e: any) {
      setGroupFetchResult(provider.id, { kind: "warn", text: `获取模型失败: ${e?.message ?? e}` });
    }
    setFetchingProvider(null);
  };

  const saveProviderKey = async (apiKeyEnv: string, value: string) => {
    const p = providers.find((pr) => pr.id === apiKeyEnv.replace("_API_KEY","").toLowerCase());
    if (p) handleSave(providers.map((x) => x.id === p.id ? { ...x, apiKey: value } : x));
  };
  const clearProviderKey = async (apiKeyEnv: string) => {
    const p = providers.find((pr) => pr.id === apiKeyEnv.replace("_API_KEY","").toLowerCase());
    if (p) handleSave(providers.map((x) => x.id === p.id ? { ...x, apiKey: undefined } : x));
    setGroupFetchResult(p?.id ?? "", null);
    setGroupModelDraft(p?.id ?? "", null);
  };
  const saveModelDraft = async (provider: Provider) => {
    const draft = modelDrafts[provider.id];
    if (!draft || draft.selected.length === 0) return;
    handleSave(providers.map((x) => x.id === provider.id ? { ...x, models: draft.selected } : x));
    setGroupModelDraft(provider.id, null);
    setGroupFetchResult(provider.id, { kind: "ok", text: `已保存 ${draft.selected.length} 个模型` });
  };

  const allRefs = providers.filter((p) => p.enabled).flatMap((p) => p.models.map((m) => `${p.id}/${m}`));
  const pickerOptions: ModelPickerOption[] = allRefs.map((ref) => {
    const pid = ref.split("/")[0];
    return { ref, provider: pid, model: ref.slice(pid.length + 1), keySet: !!providers.find((x) => x.id === pid)?.apiKey };
  });
  // Read saved model from localStorage for display
  const [selectedModelRef, setSelectedModelRef] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("aiwriter-default-model");
      if (saved) {
        const match = allRefs.find(r => r.endsWith("/" + saved) || r === saved);
        if (match) return match;
      }
    } catch {}
    return pickerOptions[0]?.ref ?? "";
  });

  return (
    <SettingsPage title="模型" desc="配置 AI 写作模型和提供商">
      <div className="settings-subtabs">
        <button type="button" className={`settings-subtab${subtab === "usage" ? " settings-subtab--active" : ""}`} aria-selected={subtab === "usage"} onClick={() => setSubtab("usage")}>使用设置</button>
        <button type="button" className={`settings-subtab${subtab === "access" ? " settings-subtab--active" : ""}`} aria-selected={subtab === "access"} onClick={() => setSubtab("access")}>接入设置</button>
      </div>
      {subtab === "usage" ? (
        <>
          <SettingsSection title="模型选择">
            <SettingsField label="默认模型">
              <ModelPicker providers={providers} refs={allRefs} value={selectedModelRef} onPick={(ref) => { setSelectedModelRef(ref); try { const parts = ref.split("/"); const modelName = parts.slice(1).join("/"); localStorage.setItem("aiwriter-default-model", modelName || ref); window.dispatchEvent(new CustomEvent("providers-changed")); } catch {} }} />
            </SettingsField>
          </SettingsSection>
          <SettingsSection title="生成参数">
            <SettingsField label="温度" hint="控制输出的随机性（0=确定，2=创意）">
              <input type="range" min="0" max="2" step="0.1" defaultValue={0.7} className="range-input" />
            </SettingsField>
            <SettingsField label="最大 Token" hint="每次生成的最大长度">
              <input type="range" min="256" max="8192" step="256" defaultValue={2048} className="range-input" />
            </SettingsField>
          </SettingsSection>
        </>
      ) : (
        <SettingsSection
          title="提供商接入"
          desc="配置 AI 模型提供商"
          actions={<button type="button" className="btn btn--small" disabled={adding !== null} onClick={() => setAdding("official")}>添加提供商</button>}
        >
          <div className="provider-access-grid">
            {groups.length === 0 && adding === null && (
              <div className="provider-empty">
                <div className="provider-empty__row">
                  <div className="provider-empty__text">
                    <strong>尚未配置提供商</strong>
                    <br />
                    <span>添加一个提供商以开始使用 AI 模型。</span>
                  </div>
                  <button type="button" className="btn btn--small" onClick={() => setAdding("official")}>官方模板</button>
                  <button type="button" className="btn btn--small" onClick={() => setAdding("custom")}>自定义</button>
                </div>
              </div>
            )}
            {adding !== null && (
              <div className="provider-add-panel">
                <div className="provider-add-panel__head">
                  <div><strong>添加提供商</strong><span>选择提供商类型</span></div>
                  <button type="button" className="btn btn--small" onClick={() => setAdding(null)}>取消</button>
                </div>
                <div className="provider-add-segmented" role="tablist">
                  <button type="button" role="tab" aria-selected={adding === "official"} className={adding === "official" ? "provider-add-segmented__item provider-add-segmented__item--active" : "provider-add-segmented__item"} onClick={() => setAdding("official")}>官方模板</button>
                  <button type="button" role="tab" aria-selected={adding === "custom"} className={adding === "custom" ? "provider-add-segmented__item provider-add-segmented__item--active" : "provider-add-segmented__item"} onClick={() => setAdding("custom")}>自定义</button>
                </div>
                {adding === "official" ? (
                  <OfficialProviderChooser
                    onAdd={(kind, apiKey) => {
                      const builtin = BUILTIN_PROVIDERS.find((b) => b.id === kind);
                      if (!builtin) { setAdding(null); return; }
                      const newProvider: Provider = {
                        id: kind,
                        label: builtin.label,
                        kind: builtin.kind,
                        baseUrl: builtin.baseUrl,
                        models: defaultModels(kind),
                        enabled: true,
                        builtin: false,
                        apiKey: apiKey || undefined,
                      };
                      handleSave([...providers, newProvider]);
                      setAdding(null);
                    }}
                  />
                ) : (
                  <CustomProviderEditor onSave={(p) => { handleSave([...providers, p]); setAdding(null); }} onCancel={() => setAdding(null)} />
                )}
              </div>
            )}
            {adding === null && groups.map((group) => (
              <ProviderAccessCard
                key={group.id} group={group}
                busy={false} fetching={fetchingProvider === group.id}
                fetchResult={fetchResults[group.id]} modelDraft={modelDrafts[group.id]}
                defaultProvider={providers[0]?.id ?? ""}
                editing={editing} kinds={["openai","anthropic","deepseek","custom"]}
                onEdit={setEditing} onCancelEdit={() => setEditing(null)}
                onSave={(p) => handleSave(providers.map((x) => x.id === p.id ? { ...x, label: p.label, baseUrl: p.baseUrl, apiKey: p.apiKey, models: p.models } : p))}
                onRefresh={() => { const pp = providers.find((x) => x.id === group.id); if (pp) refreshModels(pp); }}
                onToggleDraftModel={(model) => {
                  const d = modelDrafts[group.id]; if (!d) return;
                  const selected = d.selected.includes(model) ? d.selected.filter((m) => m !== model) : [...d.selected, model];
                  setModelDrafts((prev) => ({ ...prev, [group.id]: { ...d, selected } }));
                }}
                onSelectAllDraftModels={() => { const d = modelDrafts[group.id]; if (d) setModelDrafts((prev) => ({ ...prev, [group.id]: { ...d, selected: [...d.candidates] } })); }}
                onClearDraftModels={() => { const d = modelDrafts[group.id]; if (d) setModelDrafts((prev) => ({ ...prev, [group.id]: { ...d, selected: [] } })); }}
                onCancelDraftModels={() => setModelDrafts((prev) => { const n = { ...prev }; delete n[group.id]; return n; })}
                onSaveDraftModels={() => { const pp = providers.find((x) => x.id === group.id); if (pp) saveModelDraft(pp); }}
                onSaveEditorKey={(env, value) => saveProviderKey(env, value)}
                onClearEditorKey={(env) => clearProviderKey(env)}
                onDelete={(p) => handleSave(providers.filter((x) => x.id !== p.id))}
              />
            ))}
          </div>
        </SettingsSection>
      )}
    </SettingsPage>
  );
}

/* ─── ModelPicker（Reasonix 完全一致）─── */
function ModelPicker({ providers, refs, value, onPick, disabled, includeSameDefault, emptyOptionLabel, emptyOptionHint }: {
  providers: Provider[]; refs: string[]; value: string; onPick: (ref: string) => void; disabled?: boolean;
  includeSameDefault?: boolean; emptyOptionLabel?: string; emptyOptionHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = refs.includes(value) ? modelOptionFromRef(value, providers) : null;
  const selectedLabel = value === "" && emptyOptionLabel ? emptyOptionLabel : selected?.model || value || "未选择";
  const selectedMeta = value === "" && emptyOptionLabel ? (emptyOptionHint || "") : selected ? modelOptionMeta(selected) : "未配置";
  const emptyOptionVisible = Boolean(emptyOptionLabel) && (!query.trim() || `${emptyOptionLabel} ${emptyOptionHint || ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  const q = query.trim().toLowerCase();
  const filtered = providers.filter((p) => p.enabled && p.models.length > 0).map((p) => ({
    groupID: p.id, label: p.label, keySet: !!p.apiKey,
    options: p.models.filter((m) => {
      const ref = `${p.id}/${m}`;
      return !q || ref.toLowerCase().includes(q) || m.toLowerCase().includes(q);
    }).map((m) => ({ ref: `${p.id}/${m}`, model: m, provider: p.id, keySet: !!p.apiKey })),
  })).filter((g) => g.options.length > 0);

  useEffect(() => {
    if (!open) return;
    const pd = (e: PointerEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false); };
    const ek = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    requestAnimationFrame(() => { document.addEventListener("pointerdown", pd); document.addEventListener("keydown", ek); });
    return () => { document.removeEventListener("pointerdown", pd); document.removeEventListener("keydown", ek); };
  }, [open]);
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const pick = (ref: string) => { setOpen(false); if (ref !== value) onPick(ref); };

  return (
    <div className="settings-model-picker">
      <button ref={triggerRef} type="button" className="settings-model-picker__trigger" disabled={disabled || (!includeSameDefault && !emptyOptionLabel && refs.length === 0)} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((next) => !next)}>
        <span className="settings-model-picker__selected">
          <span>{selectedLabel}</span>
          <small>{selectedMeta}</small>
        </span>
        <ChevronDown size={16} className={`settings-model-picker__chev${open ? " settings-model-picker__chev--open" : ""}`} />
      </button>
      {open && (
        <div ref={menuRef} className="settings-model-picker__menu" style={{ width: triggerRef.current?.getBoundingClientRect().width }}>
          <div className="settings-model-picker__search">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索模型…" autoFocus />
          </div>
          <div className="settings-model-picker__list" role="listbox">
            {emptyOptionVisible && (
              <button type="button" role="option" aria-selected={value === ""}
                className={`settings-model-picker__option settings-model-picker__option--pinned${value === "" ? " settings-model-picker__option--selected" : ""}`}
                onClick={() => pick("")}>
                <span><strong>{emptyOptionLabel}</strong>{emptyOptionHint && <small>{emptyOptionHint}</small>}</span>
                {value === "" && <Check size={14} />}
              </button>
            )}
            {filtered.map((group) => (
              <div className="settings-model-picker__group" key={group.groupID}>
                <div className="settings-model-picker__group-title">
                  <span>{group.label}</span>
                  <small>{group.keySet ? "已配置" : "未配置"}</small>
                </div>
                {group.options.map((opt) => (
                  <button key={opt.ref} type="button" role="option" aria-selected={opt.ref === value}
                    className={`settings-model-picker__option${opt.ref === value ? " settings-model-picker__option--selected" : ""}`}
                    onClick={() => pick(opt.ref)}>
                    <span><strong>{opt.model}</strong><small>{modelOptionMeta(opt)}</small></span>
                    {opt.ref === value && <Check size={14} />}
                  </button>
                ))}
              </div>
            ))}
            {!emptyOptionVisible && filtered.length === 0 && <div className="settings-model-picker__empty">无匹配模型</div>}
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── OfficialProviderChooser ─── */
function OfficialProviderChooser({ onAdd }: { onAdd: (kind: OfficialProviderKind, key: string) => void }) {
  const [officialKind, setOfficialKind] = useState<OfficialProviderKind>("deepseek");
  const [key, setKey] = useState("");
  const choices: Array<{ kind: OfficialProviderKind; label: string; desc: string; keyEnv: string }> = [
    { kind: "deepseek", label: "DeepSeek", desc: "DeepSeek API，支持 chat 和 coder 模型", keyEnv: "DEEPSEEK_API_KEY" },
    { kind: "openai", label: "OpenAI", desc: "OpenAI API，支持 GPT-4o 系列模型", keyEnv: "OPENAI_API_KEY" },
    { kind: "anthropic", label: "Anthropic", desc: "Anthropic API，支持 Claude 系列模型", keyEnv: "ANTHROPIC_API_KEY" },
  ];
  const selected = choices.find((c) => c.kind === officialKind) ?? choices[0];
  return (
    <>
      <div className="provider-add-panel__hint">选择一个官方提供商模板快速接入</div>
      <div className="provider-template-grid">
        {choices.map((c) => (
          <button key={c.kind} type="button" className={`provider-template-card${officialKind === c.kind ? " provider-template-card--active" : ""}`} onClick={() => setOfficialKind(c.kind)}>
            <strong>{c.label}</strong>
            <span>{c.desc}</span>
          </button>
        ))}
      </div>
      <label className="set-label">API Key（可选）</label>
      <input className="mem-input" type="password" placeholder={`设置 Key（${selected.keyEnv}）`} value={key} onChange={(e) => setKey(e.target.value)} />
      <div className="prov-card__actions">
        <button type="button" className="btn btn--primary btn--small" onClick={() => onAdd(officialKind, key.trim())}>确认添加</button>
      </div>
    </>
  );
}

/* ─── CustomProviderEditor ─── */
function CustomProviderEditor({ onSave, onCancel }: { onSave: (p: Provider) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [models, setModels] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [apiKeyEnv, setApiKeyEnv] = useState("");
  const [balanceUrl, setBalanceUrl] = useState("");
  const [ctx, setCtx] = useState("");
  const [reasoningProtocol, setReasoningProtocol] = useState("");
  const [supportedEfforts, setSupportedEfforts] = useState<string[]>([]);
  const [customEffortDraft, setCustomEffortDraft] = useState("");
  const [defaultEffort, setDefaultEffort] = useState("");
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const presetEfforts = supportedEfforts.filter((e) => EFFORT_PRESETS.includes(e));
  const customEfforts = supportedEfforts.filter((e) => !EFFORT_PRESETS.includes(e));
  const canFetch = Boolean(name.trim() && baseUrl.trim() && keyDraft.trim());
  const modelNames = models.split("\n").concat(models.split(",")).map((s) => s.trim()).filter(Boolean);

  const togglePreset = (level: string) => {
    const has = presetEfforts.includes(level);
    const nextPresets = has ? presetEfforts.filter((e) => e !== level) : [...presetEfforts, level];
    setSupportedEfforts([...nextPresets, ...customEfforts]);
    if (has && defaultEffort === level) setDefaultEffort("");
  };

  const addCustomEffort = () => {
    const v = customEffortDraft.trim().toLowerCase();
    if (!v || supportedEfforts.includes(v)) { setCustomEffortDraft(""); return; }
    setSupportedEfforts([...presetEfforts, ...customEfforts, v]);
    setCustomEffortDraft("");
  };

  const removeCustomEffort = (level: string) => {
    setSupportedEfforts(supportedEfforts.filter((e) => e !== level));
    if (defaultEffort === level) setDefaultEffort("");
  };

  const fetchModels = async () => {
    setFetchingModels(true); setFetchStatus(null); setFetchErr(null);
    if (!name.trim() || !baseUrl.trim() || !keyDraft.trim()) {
      setFetchErr("请填写名称、Base URL 和 API Key"); setFetchingModels(false); return;
    }
    if (!isTauriEnv()) {
      setFetchErr("获取模型仅在桌面应用中可用"); setFetchingModels(false); return;
    }
    try {
      const fetched = await tryInvoke<string[]>("fetch_models_from_url", { kind: "custom", baseUrl: baseUrl.trim(), apiKey: keyDraft.trim() });
      if (fetched.length > 0) {
        setModels(fetched.filter(Boolean).join(",\n"));
        setFetchStatus(`获取到 ${fetched.length} 个模型`);
      } else {
        setFetchErr("未获取到模型");
      }
    } catch (e: any) {
      setFetchErr(`获取失败: ${e?.message ?? e}`);
    }
    setFetchingModels(false);
  };

  const protocolField = (
    <div className="provider-readonly-field provider-readonly-field--stacked" aria-readonly="true">
      <strong>OpenAI</strong>
      <span>兼容 OpenAI API 协议的提供商，如 DeepSeek、Groq 等</span>
    </div>
  );

  const advancedFields = (
    <details className="provider-editor-advanced" open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
      <summary>高级设置</summary>
      <div className="provider-editor-advanced__body">
        <label className="set-label">API Key 环境变量名</label>
        <input className="mem-input" placeholder={apiKeyEnvFromProviderName(name)} value={apiKeyEnv} onChange={(e) => setApiKeyEnv(e.target.value)} />
        <div className="mem-hint">留空自动生成。设置后可在系统环境变量中配置 Key。</div>
        <label className="set-label">余额查询 URL</label>
        <input className="mem-input" placeholder="https://api.example.com/v1/dashboard/billing" value={balanceUrl} onChange={(e) => setBalanceUrl(e.target.value)} />
        <div className="mem-hint">用于在状态栏显示账户余额。</div>
        <label className="set-label">上下文窗口</label>
        <input className="mem-input" placeholder="例如 128000（0 表示使用模型默认值）" value={ctx} onChange={(e) => setCtx(e.target.value)} inputMode="numeric" />
        <div className="mem-hint">模型的最大上下文长度（token）。仅影响用量显示。</div>
        <label className="set-label">推理协议</label>
        <select className="mem-select" value={reasoningProtocol} onChange={(e) => setReasoningProtocol(e.target.value)}>
          {REASONING_PROTOCOLS.map((protocol) => (
            <option key={protocol || "auto"} value={protocol}>
              {protocol === "" ? "自动" : protocol === "none" ? "无" : protocol.charAt(0).toUpperCase() + protocol.slice(1)}
            </option>
          ))}
        </select>
        <div className="mem-hint">控制如何解析模型的推理过程。</div>
        <label className="set-label">支持的努力程度</label>
        {EFFORT_PRESETS.map((level) => (
          <label key={level} className="set-check">
            <input type="checkbox" checked={presetEfforts.includes(level)} onChange={() => togglePreset(level)} />
            {level}
          </label>
        ))}
        <div className="set-row">
          <input className="mem-input set-grow" placeholder="自定义努力程度…" value={customEffortDraft}
            onChange={(e) => setCustomEffortDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomEffort(); } }} />
          <button type="button" className="btn btn--small" disabled={!customEffortDraft.trim() || supportedEfforts.includes(customEffortDraft.trim().toLowerCase())} onClick={addCustomEffort}>添加</button>
        </div>
        {customEfforts.length > 0 && (
          <div className="set-rules__chips">
            {customEfforts.map((level) => (
              <span className="set-rule" key={level}>
                {level}
                <button type="button" className="set-rule__x" onClick={() => removeCustomEffort(level)}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="mem-hint">模型支持的努力程度。选中预设值或添加自定义值。</div>
        <label className="set-label">默认努力程度</label>
        {supportedEfforts.length > 0 ? (
          <select className="mem-select" value={defaultEffort} onChange={(e) => setDefaultEffort(e.target.value)}>
            <option value="">自动</option>
            {supportedEfforts.map((level) => (<option key={level} value={level}>{level}</option>))}
          </select>
        ) : (
          <select className="mem-select" value="" disabled><option value="">自动</option></select>
        )}
        <div className="mem-hint">未指定努力程度时的默认值。</div>
      </div>
    </details>
  );

  const ms = models.split("\n").map((s) => s.trim()).filter(Boolean).length > 0
    ? models.split("\n").map((s) => s.trim()).filter(Boolean)
    : models.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <>
      <div className="provider-add-panel__hint">手动输入自定义提供商信息</div>
      <div className="provider-editor">
        <label className="set-label">名称</label>
        <input className="mem-input" placeholder="我的提供商" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="set-label">协议</label>
        {protocolField}
        <label className="set-label">Base URL</label>
        <input className="mem-input" placeholder="https://api.example.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        <label className="set-label">API Key</label>
        <input className="mem-input" type="password" placeholder="sk-..." value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
        <div className="provider-model-fetch-row">
          <button type="button" className="btn btn--small" disabled={fetchingModels || !canFetch} onClick={() => void fetchModels()}>
            {fetchingModels ? "获取中…" : "测试并获取模型"}
          </button>
          <span>填写名称、Base URL 和 API Key 后即可测试连接并获取可用模型。</span>
        </div>
        {fetchStatus && <div className="provider-fetch-status provider-fetch-status--ok">{fetchStatus}</div>}
        {fetchErr && <div className="provider-fetch-status provider-fetch-status--error">{fetchErr}</div>}
        {modelNames.length > 0 && (
          <div className="provider-card-block">
            <div className="provider-card-block__label">可用模型</div>
            <div className="provider-model-chips">
              {modelNames.slice(0, 8).map((model) => (<span className="provider-model-chip" key={model}>{model}</span>))}
              {modelNames.length > 8 && <span className="provider-model-chip provider-model-chip--more">+{modelNames.length - 8}</span>}
            </div>
          </div>
        )}
        <label className="set-label">手动输入模型</label>
        <textarea className="settings-textarea" rows={3} value={models} onChange={(e) => setModels(e.target.value)} placeholder="每行一个模型名称，或逗号分隔" />
        <div className="mem-hint">模型名称列表。可从上方获取结果中自动填入，也可手动输入。</div>
        {advancedFields}
        <div className="prov-card__actions">
          <button type="button" className="btn btn--small" onClick={onCancel}>取消</button>
          <button type="button" className="btn btn--primary btn--small" disabled={!name.trim() || !baseUrl.trim() || !models.trim()} onClick={() => onSave({ id: "custom-"+Date.now(), label: name.trim() || "新提供商", kind: "custom", baseUrl: baseUrl.trim() || undefined, apiKey: keyDraft.trim() || undefined, models: models.split("\n").map((s) => s.trim()).filter(Boolean).length > 0 ? models.split("\n").map((s) => s.trim()).filter(Boolean) : models.split(",").map((s) => s.trim()).filter(Boolean), enabled: true, builtin: false })}>确认添加</button>
        </div>
      </div>
    </>
  );
}

/* ─── ProviderModelDraftPicker (Reasonix exact) ─── */
function ProviderModelDraftPicker({ draft, busy, fetching, onToggle, onSelectAll, onClear, onCancel, onSave }: {
  draft: ProviderModelDraft; busy: boolean; fetching: boolean;
  onToggle: (model: string) => void; onSelectAll: () => void; onClear: () => void; onCancel: () => void; onSave: () => void;
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(draft.selected);
  const q = query.trim().toLowerCase();
  const visible = q ? draft.candidates.filter((m) => m.toLowerCase().includes(q)) : draft.candidates;
  const disabled = busy || fetching;
  return (
    <div className="provider-model-draft">
      <div className="provider-model-draft__head">
        <div>
          <div className="provider-card-block__label">模型候选</div>
          <span>已选 {draft.selected.length} 个</span>
        </div>
        <div className="provider-model-draft__tools">
          <button type="button" className="btn btn--small" disabled={disabled || draft.selected.length === draft.candidates.length} onClick={onSelectAll}>全选</button>
          <button type="button" className="btn btn--small" disabled={disabled || draft.selected.length === 0} onClick={onClear}>清空</button>
        </div>
      </div>
      <input className="mem-input provider-model-draft__search" placeholder="搜索模型…" value={query} disabled={disabled} onChange={(e) => setQuery(e.target.value)} />
      <div className="provider-model-draft__list" role="list">
        {visible.map((model) => (
          <label className="provider-model-draft__option" key={model}>
            <input type="checkbox" checked={selected.has(model)} disabled={disabled} onChange={() => onToggle(model)} />
            <span>{model}</span>
          </label>
        ))}
        {visible.length === 0 && <div className="provider-model-draft__empty">无匹配模型</div>}
      </div>
      <div className="provider-model-draft__actions">
        <button type="button" className="btn btn--small" disabled={disabled} onClick={onCancel}>取消</button>
        <button type="button" className="btn btn--small btn--primary" disabled={disabled || draft.selected.length === 0} onClick={onSave}>保存已选模型</button>
      </div>
    </div>
  );
}

/* ─── ProviderAccessCard (Reasonix exact) ─── */
function ProviderAccessCard({ group, busy, fetching, fetchResult, modelDraft, defaultProvider, editing, kinds, onEdit, onCancelEdit, onSave, onRefresh, onToggleDraftModel, onSelectAllDraftModels, onClearDraftModels, onCancelDraftModels, onSaveDraftModels, onSaveEditorKey, onClearEditorKey, onDelete }: {
  group: ProviderAccessGroup; busy: boolean; fetching: boolean;
  fetchResult?: ProviderFetchResult; modelDraft?: ProviderModelDraft;
  defaultProvider: string; editing: string | null; kinds: string[];
  onEdit: (name: string | null) => void; onCancelEdit: () => void;
  onSave: (p: Provider) => void; onRefresh: () => void;
  onToggleDraftModel: (model: string) => void; onSelectAllDraftModels: () => void; onClearDraftModels: () => void;
  onCancelDraftModels: () => void; onSaveDraftModels: () => void;
  onSaveEditorKey: (env: string, value: string) => void; onClearEditorKey: (env: string) => void;
  onDelete: (p: Provider) => void;
}) {
  const provider = group.providers[0];
  const isDefault = group.id === defaultProvider;
  const editingProvider = editing === group.id;
  const visibleModels = group.models.slice(0, 6);
  const hiddenModelCount = Math.max(0, group.models.length - visibleModels.length);

  return (
    <article className={`provider-access-card${group.builtIn ? " provider-access-card--builtin" : ""}`}>
      <div className="provider-access-card__head">
        <div className="provider-access-card__identity">
          <div className="provider-access-card__title">
            {group.label}
            <span className={`badge ${group.builtIn ? "badge--project" : "badge--neutral"}`}>{group.builtIn ? "内置" : "自定义"}</span>
            <span className={`badge ${group.keySet ? "badge--project" : "badge--feedback"}`}>{group.keySet ? "已配置" : "未配置"}</span>
          </div>
          <div className="provider-access-card__desc">{group.description}</div>
        </div>
        <div className="provider-access-card__actions">
          <button className="btn btn--small" disabled={busy} aria-expanded={editingProvider} onClick={() => editingProvider ? onCancelEdit() : onEdit(group.id)}>{editingProvider ? "收起" : "配置"}</button>
          <button className="btn btn--small" disabled={busy || fetching || !group.baseUrl || !group.apiKeyEnv || !group.keySet} onClick={onRefresh}>{fetching ? "获取中…" : "获取模型"}</button>
          {provider && onDelete && !group.builtIn && (
            <InlineConfirmButton label="删除" confirmLabel="确认删除" cancelLabel="取消" danger onConfirm={() => onDelete(provider)} />
          )}
        </div>
      </div>

      <div className="provider-access-meta">
        <span>{group.kind}</span>
        <span>{group.baseUrl}</span>
        <span>{group.apiKeyEnv || "无"}</span>
      </div>

      <div className="provider-card-block">
        <div className="provider-card-block__label">{group.keySet ? "已启用模型" : "模型列表"}</div>
        <div className="provider-model-chips" aria-label={group.keySet ? "已启用模型" : "模型列表"}>
          {visibleModels.length > 0
            ? visibleModels.map((model) => (<span className="provider-model-chip" key={model}>{model}</span>))
            : <span className="provider-model-chip provider-model-chip--empty">未配置模型</span>}
          {hiddenModelCount > 0 && <span className="provider-model-chip provider-model-chip--more">+{hiddenModelCount}</span>}
        </div>
        {!group.keySet && <div className="provider-card-status provider-card-status--warn">需配置 API Key 后方可使用</div>}
        {fetchResult && <div className={`provider-card-status provider-card-status--${fetchResult.kind}`}>{fetchResult.text}</div>}
      </div>

      {modelDraft && (
        <ProviderModelDraftPicker draft={modelDraft} busy={busy} fetching={fetching}
          onToggle={onToggleDraftModel} onSelectAll={onSelectAllDraftModels} onClear={onClearDraftModels}
          onCancel={onCancelDraftModels} onSave={onSaveDraftModels} />
      )}

      {group.providers.length > 1 && (
        <div className="provider-profiles">
          {group.providers.map((p) => (
            <div className="provider-profile-row" key={p.id}>
              <span>{p.label}</span>
              <span>{p.models.join(", ") || "无"}</span>
              <button className="btn btn--small" disabled={busy} aria-expanded={editing === p.id} onClick={() => editing === p.id ? onCancelEdit() : onEdit(p.id)}>{editing === p.id ? "收起" : "配置"}</button>
            </div>
          ))}
        </div>
      )}

      {editingProvider && provider && (
        <ProviderEditor provider={provider} onSave={onSave} onSaveKey={onSaveEditorKey} onClearKey={onClearEditorKey} group={group} />
      )}
    </article>
  );
}

/* ─── Constants & helpers (Reasonix exact) ─── */
const EFFORT_PRESETS: readonly string[] = ["low", "medium", "high", "xhigh", "max"];
const REASONING_PROTOCOLS: readonly string[] = ["", "deepseek", "openai", "none"];

function normalizeReasoningProtocol(protocol: string | undefined): string {
  return REASONING_PROTOCOLS.includes(protocol ?? "") ? protocol ?? "" : "";
}

function apiKeyEnvFromProviderName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "_") + "_API_KEY";
}

/* ─── ProviderEditor (Reasonix 完全一致) ─── */
function ProviderEditor({ provider, onSave, onSaveKey, onClearKey, group, onCancel }: {
  provider: Provider; onSave: (p: Provider) => void;
  onSaveKey?: (env: string, value: string) => void; onClearKey?: (env: string) => void;
  group: ProviderAccessGroup; onCancel?: () => void;
}) {
  const builtIn = provider.builtin;
  // All hooks at top
  const [val, setVal] = useState("");
  const [name, setName] = useState(provider.label);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [models, setModels] = useState(provider.models.join(", "));
  const [keyDraft, setKeyDraft] = useState("");
  const [apiKeyEnv, setApiKeyEnv] = useState("");
  const [balanceUrl, setBalanceUrl] = useState("");
  const [ctx, setCtx] = useState("");
  const [reasoningProtocol, setReasoningProtocol] = useState("");
  const [supportedEfforts, setSupportedEfforts] = useState<string[]>([]);
  const [customEffortDraft, setCustomEffortDraft] = useState("");
  const [defaultEffort, setDefaultEffort] = useState("");
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [kind, setKind] = useState("openai");

  const presetEfforts = supportedEfforts.filter((e) => EFFORT_PRESETS.includes(e));
  const customEfforts = supportedEfforts.filter((e) => !EFFORT_PRESETS.includes(e));
  const canFetch = Boolean(name.trim() && baseUrl.trim() && (keyDraft.trim() || apiKeyEnv.trim()));
  const modelNames = models.split(",").map((s) => s.trim()).filter(Boolean);

  const togglePreset = (level: string) => {
    const has = presetEfforts.includes(level);
    const nextPresets = has ? presetEfforts.filter((e) => e !== level) : [...presetEfforts, level];
    setSupportedEfforts([...nextPresets, ...customEfforts]);
    if (has && defaultEffort === level) setDefaultEffort("");
  };

  const addCustomEffort = () => {
    const v = customEffortDraft.trim().toLowerCase();
    if (!v || supportedEfforts.includes(v)) { setCustomEffortDraft(""); return; }
    setSupportedEfforts([...presetEfforts, ...customEfforts, v]);
    setCustomEffortDraft("");
  };

  const removeCustomEffort = (level: string) => {
    setSupportedEfforts(supportedEfforts.filter((e) => e !== level));
    if (defaultEffort === level) setDefaultEffort("");
  };

  const fetchModels = async () => {
    setFetchingModels(true); setFetchStatus(null); setFetchErr(null);
    if (!name.trim() || !baseUrl.trim()) { setFetchErr("请填写名称和 Base URL"); setFetchingModels(false); return; }
    if (!isTauriEnv()) {
      setFetchErr("获取模型仅在桌面应用中可用"); setFetchingModels(false); return;
    }
    const effectiveKey = keyDraft.trim() || "(stored)";
    try {
      const fetched = await tryInvoke<string[]>("fetch_models_from_url", { kind: "custom", baseUrl: baseUrl.trim(), apiKey: effectiveKey });
      if (fetched.length > 0) {
        setModels(fetched.filter(Boolean).join(", "));
        setFetchStatus(`获取到 ${fetched.length} 个模型`);
      } else {
        setFetchErr("未获取到模型");
      }
    } catch (e: any) {
      setFetchErr(`获取失败: ${e?.message ?? e}`);
    }
    setFetchingModels(false);
  };

  if (builtIn) {
    return (
      <div className="provider-editor provider-editor--builtin provider-editor--key-only">
        <div className="provider-key-status provider-key-status--managed provider-key-status--compact">
          <span>{group.keySet ? `已配置 Key（${group.apiKeyEnv}）` : `未配置 Key（${group.apiKeyEnv}）`}</span>
          {group.keySet && <InlineConfirmButton label="清除 Key" confirmLabel="确认清除" cancelLabel="取消" danger onConfirm={() => onClearKey?.(group.apiKeyEnv)} />}
        </div>
        <div className="set-key">
          <input className="mem-input" type="password" placeholder={group.keySet ? "更新 API Key" : "设置 API Key"} value={val} onChange={(e) => setVal(e.target.value)} />
          <button className="btn btn--small btn--primary" disabled={!val.trim()} onClick={() => { onSaveKey?.(group.apiKeyEnv, val.trim()); setVal(""); }}>{group.keySet ? "更新" : "保存"}</button>
        </div>
      </div>
    );
  }

  const protocolField = (
    <div className="provider-readonly-field provider-readonly-field--stacked" aria-readonly="true">
      <strong>OpenAI</strong>
      <span>兼容 OpenAI API 协议的提供商，如 DeepSeek、Groq 等</span>
    </div>
  );

  const advancedFields = (
    <details className="provider-editor-advanced" open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
      <summary>高级设置</summary>
      <div className="provider-editor-advanced__body">
        <label className="set-label">API Key 环境变量名</label>
        <input className="mem-input" placeholder={apiKeyEnvFromProviderName(name)} value={apiKeyEnv} onChange={(e) => setApiKeyEnv(e.target.value)} />
        <div className="mem-hint">留空自动生成。设置后可在系统环境变量中配置 Key。</div>
        <label className="set-label">余额查询 URL</label>
        <input className="mem-input" placeholder="https://api.example.com/v1/dashboard/billing" value={balanceUrl} onChange={(e) => setBalanceUrl(e.target.value)} />
        <div className="mem-hint">用于在状态栏显示账户余额。</div>
        <label className="set-label">上下文窗口</label>
        <input className="mem-input" placeholder="例如 128000（0 表示使用模型默认值）" value={ctx} onChange={(e) => setCtx(e.target.value)} inputMode="numeric" />
        <div className="mem-hint">模型的最大上下文长度（token）。仅影响用量显示。</div>
        <label className="set-label">推理协议</label>
        <select className="mem-select" value={reasoningProtocol} onChange={(e) => setReasoningProtocol(e.target.value)}>
          {REASONING_PROTOCOLS.map((protocol) => (
            <option key={protocol || "auto"} value={protocol}>
              {protocol === "" ? "自动" : protocol === "none" ? "无" : protocol.charAt(0).toUpperCase() + protocol.slice(1)}
            </option>
          ))}
        </select>
        <div className="mem-hint">控制如何解析模型的推理过程。</div>
        <label className="set-label">支持的努力程度</label>
        {EFFORT_PRESETS.map((level) => (
          <label key={level} className="set-check">
            <input type="checkbox" checked={presetEfforts.includes(level)} onChange={() => togglePreset(level)} />
            {level}
          </label>
        ))}
        <div className="set-row">
          <input className="mem-input set-grow" placeholder="自定义努力程度…" value={customEffortDraft}
            onChange={(e) => setCustomEffortDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomEffort(); } }} />
          <button type="button" className="btn btn--small" disabled={!customEffortDraft.trim() || supportedEfforts.includes(customEffortDraft.trim().toLowerCase())} onClick={addCustomEffort}>添加</button>
        </div>
        {customEfforts.length > 0 && (
          <div className="set-rules__chips">
            {customEfforts.map((level) => (
              <span className="set-rule" key={level}>
                {level}
                <button type="button" className="set-rule__x" onClick={() => removeCustomEffort(level)}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="mem-hint">模型支持的努力程度。选中预设值或添加自定义值。</div>
        <label className="set-label">默认努力程度</label>
        {supportedEfforts.length > 0 ? (
          <select className="mem-select" value={defaultEffort} onChange={(e) => setDefaultEffort(e.target.value)}>
            <option value="">自动</option>
            {supportedEfforts.map((level) => (<option key={level} value={level}>{level}</option>))}
          </select>
        ) : (
          <select className="mem-select" value="" disabled><option value="">自动</option></select>
        )}
        <div className="mem-hint">未指定努力程度时的默认值。</div>
      </div>
    </details>
  );

  return (
    <div className="provider-editor">
      <label className="set-label">名称</label>
      <input className="mem-input" placeholder="我的提供商" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="set-label">协议</label>
      {protocolField}
      <label className="set-label">Base URL</label>
      <input className="mem-input" placeholder="https://api.example.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
      <label className="set-label">API Key</label>
      <input className="mem-input" type="password" placeholder={provider.apiKey ? "（已配置，留空则不变）" : "sk-..."} value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
      <div className="provider-model-fetch-row">
        <button type="button" className="btn btn--small" disabled={fetchingModels || !canFetch} onClick={() => void fetchModels()}>
          {fetchingModels ? "获取中…" : "测试并获取模型"}
        </button>
        <span>填写名称、Base URL 和 API Key 后即可测试连接并获取可用模型。</span>
      </div>
      {fetchStatus && <div className="provider-fetch-status provider-fetch-status--ok">{fetchStatus}</div>}
      {fetchErr && <div className="provider-fetch-status provider-fetch-status--error">{fetchErr}</div>}
      {modelNames.length > 0 && (
        <div className="provider-card-block">
          <div className="provider-card-block__label">可用模型</div>
          <div className="provider-model-chips">
            {modelNames.slice(0, 8).map((model) => (<span className="provider-model-chip" key={model}>{model}</span>))}
            {modelNames.length > 8 && <span className="provider-model-chip provider-model-chip--more">+{modelNames.length - 8}</span>}
          </div>
        </div>
      )}
      <label className="set-label">手动输入模型</label>
      <input className="mem-input" placeholder="模型名称，用逗号分隔" value={models} onChange={(e) => setModels(e.target.value)} />
      <div className="mem-hint">模型名称列表。可从上方获取结果中自动填入，也可手动输入。</div>
      {advancedFields}
      <div className="prov-card__actions">
        {onCancel && <button className="btn btn--small" onClick={onCancel}>取消</button>}
        <button className="btn btn--primary btn--small" disabled={!name.trim() || !baseUrl.trim()} onClick={() => {
          const newApiKey = keyDraft.trim();
          if (newApiKey && group.apiKeyEnv) onSaveKey?.(group.apiKeyEnv, newApiKey);
          onSave({ 
            ...provider, 
            label: name.trim() || provider.id, 
            baseUrl: baseUrl.trim() || undefined, 
            apiKey: newApiKey || provider.apiKey,
            models: models.split(",").map((s) => s.trim()).filter(Boolean) 
          });
        }}>保存</button>
      </div>
    </div>
  );
}
/* ════════════════════════════════════════════════
   PLATFORMS — 发布平台配置
   ════════════════════════════════════════════════ */
function PlatformsSection() {
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingInitial, setEditingInitial] = useState<Partial<PlatformConfig> | null>(null);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(false);

  // Fetch public IP for IP whitelist configuration
  useEffect(() => {
    let cancelled = false;
    setIpLoading(true);
    // Try multiple IP APIs for reliability
    const ipApis = [
      "https://httpbin.org/ip",
      "https://checkip.amazonaws.com",
      "https://icanhazip.com",
    ];
    (async () => {
      let found = false;
      for (const url of ipApis) {
        if (found) break;
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const text = await res.text();
          let ip: string | null = null;
          if (text.trim().startsWith("{")) {
            const json = JSON.parse(text);
            ip = json.origin || null;
          } else {
            ip = text.trim();
          }
          if (ip && /^[\d.]+$/.test(ip)) {
            if (!cancelled) setPublicIp(ip);
            found = true;
          }
        } catch {}
      }
      if (!found && !cancelled) setPublicIp(null);
      if (!cancelled) setIpLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    getPlatformConfigs().then((cfgs) => {
      setConfigs(cfgs);
      setLoaded(true);
    });
  }, []);

  const handleSave = async (cfg: PlatformConfig) => {
    await savePlatformConfig(cfg);
    const cfgs = await getPlatformConfigs();
    setConfigs(cfgs);
    setEditingId(null);
    setEditingInitial(null);
    setVerifyResult(null);
  };

  const handleDelete = async (id: string) => {
    await deletePlatformConfig(id);
    setConfigs((prev) => prev.filter((c) => c.id !== id));
  };

  const handleVerify = async (cfg: PlatformConfig) => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const ok = await verifyPlatformCredentials(cfg.platform, cfg.appId, cfg.appSecret);
      setVerifyResult(ok ? "✅ 凭据有效" : "❌ 凭据无效");
    } catch (e: any) {
      setVerifyResult("❌ 验证失败: " + (e?.message || "未知错误"));
    }
    setVerifying(false);
  };

  const startEdit = (cfg: Partial<PlatformConfig>) => {
    setEditingInitial(cfg);
    setEditingId(cfg.id || "new");
    setVerifyResult(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingInitial(null);
    setVerifyResult(null);
  };

  if (!loaded) return <div className="settings-page"><p>加载中...</p></div>;

  // ── Editing mode: show form instead of cards ──
  if (editingId !== null && editingInitial) {
    const isNew = editingId === "new" || !configs.some((c) => c.id === editingId);
    return (
      <SettingsPage
        title={isNew ? "添加平台" : "编辑平台"}
        desc="配置第三方平台接入凭据"
      >
        <PlatformConfigForm
          initial={editingInitial}
          onSave={handleSave}
          onCancel={cancelEdit}
          onVerify={handleVerify}
          verifying={verifying}
          verifyResult={verifyResult}
        />
      </SettingsPage>
    );
  }

  // ── List mode: show cards + add button ──
  return (
    <SettingsPage title="发布平台" desc="配置第三方平台的接入凭据">
      {/* IP whitelist hint */}
      <div className="platform-ip-hint">
        <span className="platform-ip-hint__label">本机公网 IP：</span>
        {ipLoading ? (
          <span className="platform-ip-hint__value">查询中...</span>
        ) : publicIp ? (
          <>
            <code className="platform-ip-hint__value">{publicIp}</code>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => { navigator.clipboard.writeText(publicIp); }}
              title="复制 IP"
            >复制</button>
          </>
        ) : (
          <span className="platform-ip-hint__value platform-ip-hint__value--fail">获取失败</span>
        )}
        <span className="platform-ip-hint__note">用于配置公众号 IP 白名单</span>
      </div>
      {configs.length === 0 ? (
        <div className="provider-empty">
          <div className="provider-empty__row">
            <div className="provider-empty__text">
              <strong>尚未配置发布平台</strong>
              <span>添加微信公众号等平台的凭据以发布文章。</span>
            </div>
            <button type="button" className="btn btn--small" onClick={() => startEdit({ id: "", platform: "wechat", label: "", appId: "", appSecret: "", enabled: true })}>添加平台</button>
          </div>
        </div>
      ) : (
        <>
          <div className="platform-grid">
            {configs.map((cfg) => (
              <div key={cfg.id} className="platform-card">
                <div className="platform-card__head">
                  <strong>{cfg.label}</strong>
                  <span className="platform-card__badge">{cfg.platform === "wechat" ? "微信公众号" : cfg.platform}</span>
                </div>
                <div className="platform-card__info">
                  <span>AppID: {cfg.appId ? cfg.appId.slice(0, 8) + "..." : "未设置"}</span>
                  <span className={"platform-status" + (cfg.enabled ? " platform-status--ok" : "")}>
                    {cfg.enabled ? "已启用" : "已禁用"}
                  </span>
                </div>
                <div className="platform-card__actions">
                  <button type="button" className="btn btn--small" onClick={() => startEdit(cfg)}>编辑</button>
                  <button type="button" className="btn btn--small btn--danger" onClick={() => handleDelete(cfg.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--small" style={{ marginTop: 12 }} onClick={() => startEdit({ id: "", platform: "wechat", label: "", appId: "", appSecret: "", enabled: true })}>
            添加平台
          </button>
        </>
      )}
    </SettingsPage>
  );
}

function PlatformConfigForm({
  initial, onSave, onCancel, onVerify, verifying, verifyResult,
}: {
  initial: Partial<PlatformConfig>;
  onSave: (cfg: PlatformConfig) => void;
  onCancel: () => void;
  onVerify: (cfg: PlatformConfig) => void;
  verifying: boolean;
  verifyResult: string | null;
}) {
  const [platform, setPlatform] = useState(initial.platform || "wechat");
  const [label, setLabel] = useState(initial.label || "");
  const [appId, setAppId] = useState(initial.appId || "");
  const [appSecret, setAppSecret] = useState(initial.appSecret || "");
  const [enabled, setEnabled] = useState(initial.enabled !== false);

  const currentCfg = (): PlatformConfig => ({
    id: initial.id || "new_draft",
    platform,
    label: label || (platform === "wechat" ? "微信公众号" : platform),
    appId,
    appSecret,
    enabled,
  });

  return (
    <div className="platform-form">
      <div className="platform-form__field">
        <label>平台类型</label>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input">
          <option value="wechat">微信公众号</option>
          <option value="toutiao" disabled>今日头条（待实现）</option>
        </select>
      </div>
      <div className="platform-form__field">
        <label>显示名称</label>
        <input type="text" className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={platform === "wechat" ? "微信公众号" : ""} />
      </div>
      <div className="platform-form__field">
        <label>AppID</label>
        <input type="text" className="input" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="输入 AppID" />
      </div>
      <div className="platform-form__field">
        <label>AppSecret</label>
        <input type="password" className="input" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="输入 AppSecret" />
      </div>
      <div className="platform-form__field">
        <label className="checkbox-label">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>启用</span>
        </label>
      </div>
      <div className="platform-form__actions">
        <button type="button" className="btn btn--small" disabled={!appId || !appSecret || verifying} onClick={() => onVerify(currentCfg())}>
          {verifying ? "验证中..." : "验证凭据"}
        </button>
        {verifyResult && <span className="platform-verify-result">{verifyResult}</span>}
      </div>
      <div className="platform-form__actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn btn--small btn--primary" disabled={!appId || !appSecret} onClick={() => onSave(currentCfg())}>保存</button>
        <button type="button" className="btn btn--small" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

import { useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import {
  Palette, FileText, Cpu, Keyboard, Info, X, Zap,
  Monitor, Sun, Plus, Trash2, Check, Sparkles, ChevronDown, ChevronRight,
} from "lucide-react";
import type { ThemeStyle, Theme } from "../lib/theme";
import { THEME_STYLES } from "../lib/theme";
import type { TextSize } from "../lib/textSize";
import { TEXT_SIZES } from "../lib/textSize";
import type { FontFamily } from "../lib/fontFamily";
import { FONT_FAMILIES, applyFontFamily, getCustomFontName, setCustomFontName } from "../lib/fontFamily";
import { type Provider, BUILTIN_PROVIDERS, getProvidersSync, saveProvidersSync, defaultModels } from "../lib/providerModels";
import { InlineConfirmButton } from "./InlineConfirmButton";
import { isTauriEnv, tryInvoke } from "../lib/tauri";

/* ─── Tab definitions ─── */
export type SettingsTab = "appearance" | "editor" | "models" | "shortcuts" | "skills" | "about";

const TABS: { id: SettingsTab; icon: ReactNode; label: string }[] = [
  { id: "appearance", icon: <Palette size={14} />, label: "外观" },
  { id: "editor",    icon: <FileText size={14} />, label: "编辑器" },
  { id: "models",    icon: <Cpu size={14} />,      label: "模型" },
  { id: "shortcuts", icon: <Keyboard size={14} />, label: "快捷键" },
  { id: "skills",    icon: <Zap size={14} />,       label: "技能" },
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
const DEFAULT_SHORTCUTS = [
  { label: "命令面板", keys: "Ctrl+K" },
  { label: "切换侧栏", keys: "Ctrl+\\" },
  { label: "切换 AI 面板", keys: "Ctrl+Shift+\\" },
  { label: "焦点模式", keys: "Ctrl+Shift+F" },
  { label: "新建文档", keys: "Ctrl+N" },
  { label: "保存", keys: "Ctrl+S" },
  { label: "查找替换", keys: "Ctrl+F" },
  { label: "打开设置", keys: "Ctrl+," },
  { label: "加粗", keys: "Ctrl+B" },
  { label: "斜体", keys: "Ctrl+I" },
  { label: "接受 AI 建议", keys: "Tab" },
  { label: "忽略 AI 建议 / 关闭面板", keys: "Esc" },
];

function ShortcutsSection() {
  return (
    <SettingsPage title="快捷键" desc="所有操作均可通过键盘完成">
      <div className="shortcuts-table">
        <div className="shortcuts-table__head"><span>操作</span><span>快捷键</span></div>
        {DEFAULT_SHORTCUTS.map((sc, i) => (
          <div key={i} className="shortcuts-table__row">
            <span>{sc.label}</span>
            <kbd className="shortcut-key">{sc.keys}</kbd>
          </div>
        ))}
      </div>
    </SettingsPage>
  );
}

/* ════════════════════════════════════════════════
   ABOUT SECTION
   ════════════════════════════════════════════════ */
function SkillsSection() {
  const [skills, setSkills] = useState<{ name: string; description: string; enabled: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { listSkills } = await import("../lib/skill");
        const list = await listSkills();
        setSkills(list.map((s: any) => ({ name: s.name, description: s.description, enabled: s.enabled !== false })));
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

  const skillNames: Record<string, string> = {
    "continue-writing": "续写",
    "rewrite": "改写",
    "polish": "润色",
    "translate": "翻译",
    "academic": "学术写作",
    "creative": "创意写作",
    "summary": "摘要",
    "outline": "大纲",
    "expand": "扩写",
    "paraphrase": "同义改写",
    "proofread": "校对",
    "blog": "博客",
    "novel": "小说",
    "headline": "标题",
    "email": "邮件",
    "keyword-extract": "关键词",
    "readability": "可读性",
    "citation": "引用",
  };

  return (
    <SettingsPage title="技能" desc="管理 AI 写作技能，启用或禁用特定功能">
      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>加载中…</div>
      ) : (
        <div className="skills-list">
          {skills.map((s) => (
            <div key={s.name} className={"skills-list__item" + (expandedSkill === s.name ? " skills-list__item--expanded" : "")}>
              <div className="skills-list__header" onClick={() => setExpandedSkill(expandedSkill === s.name ? null : s.name)}>
                <span className="skills-list__chevron">
                  {expandedSkill === s.name ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
                <span className="skills-list__name">{skillNames[s.name] || s.name}</span>
                <span className="skills-list__desc">{s.description}</span>
                <button
                  className={"skills-list__toggle" + (s.enabled ? " skills-list__toggle--on" : "")}
                  onClick={(e) => { e.stopPropagation(); toggleSkill(s.name, !s.enabled); }}
                  title={s.enabled ? "禁用" : "启用"}
                >
                  <Check size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsPage>
  );
}

function AboutSection() {
  return (
    <SettingsPage title="关于">
      <div className="about-card">
        <div className="about-card__logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <h3>AI 写作助手</h3>
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
                <strong>尚未配置提供商</strong>
                <span>添加一个提供商以开始使用 AI 模型。</span>
                <div className="provider-empty__actions">
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

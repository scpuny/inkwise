import { Palette, Type, X, AlignLeft, FileText, ChevronDown, TextSelect, Code2, Pilcrow, ListOrdered, ImageIcon, Search } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { getAllTemplates, setSelectedTemplateId, getAllCodeThemes, setSelectedCodeTheme, applyMacosCodeBlockStyle, applyTextStyle, applyHeadingDecorations, applyBgPattern, applyAccentColor, applyImageCaptionFormat, applyCustomCSS, getAllAccentColors, type EditorStyleTemplate, type CodeTheme } from "../../lib/editor/editorStyles";
import { getAllThemes, getThemeById, getSelectedArticleThemeId, setSelectedArticleThemeId, isPresetTheme, PLATFORMS, type ArticleTheme } from "../../lib/theme/articleThemes";
import { CustomSelect, type CustomSelectOption } from "../common/CustomSelect";

interface StylePanelProps {
  open: boolean;
  onClose: () => void;
  editorStyleTemplateId: string;
  lineHeight: number;
  onSetEditorStyleTemplate: (id: string) => void;
  onSetLineHeight: (h: number) => void;
  editorFontSize?: number;
  onSetEditorFontSize?: (px: number) => void;
  editorMaxWidth?: number;
  onSetEditorMaxWidth?: (px: number) => void;
  editorParagraphGap?: number;
  onSetEditorParagraphGap?: (px: number) => void;
  editorFontFamily?: string;
  onSetEditorFontFamily?: (font: string) => void;
  codeThemeId?: string;
  onSetCodeTheme?: (id: string) => void;
  onApplyHeadingNumbers?: () => void;
}

// Font family presets for article content
const ARTICLE_THEME_IDS = ["wechat","zhihu","toutiao","medium","notion","clean"];
const FONT_PRESETS: { label: string; value: string }[] = [
  { label: "系统默认", value: "" },
  { label: "宋体", value: "Cambria, 'Noto Serif SC', 'Source Han Serif SC', Georgia, serif" },
  { label: "楷体", value: "'KaiTi', 'STKaiti', 'Noto Serif SC', serif" },
  { label: "仿宋", value: "'FangSong', 'STFangsong', serif" },
  { label: "黑体", value: "'SimHei', 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { label: "衬线体", value: "'Noto Serif SC', 'Source Han Serif SC', Georgia, 'Times New Roman', serif" },
  { label: "无衬线", value: "-apple-system, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif" },
  { label: "等宽", value: "'SF Mono', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace" },
];

export function StylePanel({
  open, onClose,
  editorStyleTemplateId, lineHeight,
  onSetEditorStyleTemplate, onSetLineHeight,
  editorFontSize = 15, onSetEditorFontSize,
  editorMaxWidth = 820, onSetEditorMaxWidth,
  editorParagraphGap = 1.25, onSetEditorParagraphGap,
  editorFontFamily = "", onSetEditorFontFamily,
  codeThemeId = "atom-one-light", onSetCodeTheme,
  onApplyHeadingNumbers,
}: StylePanelProps) {
  const templates = getAllTemplates().filter(t => !t.disabled);
  const codeThemes = getAllCodeThemes();
  const currentTemplate = templates.find(t => t.id === editorStyleTemplateId);
  const currentCodeTheme = codeThemes.find(t => t.id === codeThemeId);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [codeThemeOpen, setCodeThemeOpen] = useState(false);
  const [articleThemeId, setArticleThemeId] = useState(getSelectedArticleThemeId());
  const articleThemes = getAllThemes();
  const currentArticleTheme = getThemeById(articleThemeId);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeSearch, setThemeSearch] = useState("");
  const [themePage, setThemePage] = useState(0);
  const [themePlatform, setThemePlatform] = useState("all");
  const platformOptions: CustomSelectOption[] = [
    { value: "all", label: "全部主题" },
    ...PLATFORMS.map(p => ({ value: p.id, label: p.label })),
  ];
    const [macosCodeBlock, setMacosCodeBlock] = useState(localStorage.getItem('macos-code-block') === 'true');
  const [firstLineIndent, setFirstLineIndent] = useState(localStorage.getItem('first-line-indent') === 'true');
  const [justifyAlign, setJustifyAlign] = useState(localStorage.getItem('justify-align') === 'true');
  const [headingConfig, setHeadingConfig] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem("heading-deco-config") || "{}"); } catch { return {}; }
  });
  const [bgPattern, setBgPattern] = useState(localStorage.getItem('bg-pattern') || '');
  const [accentColor, setAccentColor] = useState(localStorage.getItem("editor-accent-color") || "");
  const [captionFormat, setCaptionFormat] = useState(localStorage.getItem("editor-caption-format") || "");
  const [customCSS, setCustomCSS] = useState(localStorage.getItem("editor-custom-css") || "");
  const [headingLevelOpen, setHeadingLevelOpen] = useState(false);
    const [fontFamilyOpen, setFontFamilyOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);
  const codeThemeRef = useRef<HTMLDivElement>(null);
  const fontFamilyRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const headingLevelRef = useRef<HTMLDivElement>(null);
  
  // Close dropdowns on outside click
  useEffect(() => {
    if (!templateOpen && !codeThemeOpen && !fontFamilyOpen && !themeOpen && !headingLevelOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (templateOpen && templateRef.current && !templateRef.current.contains(target)) setTemplateOpen(false);
      if (codeThemeOpen && codeThemeRef.current && !codeThemeRef.current.contains(target)) setCodeThemeOpen(false);
      if (fontFamilyOpen && fontFamilyRef.current && !fontFamilyRef.current.contains(target)) setFontFamilyOpen(false);
      if (themeOpen && themeRef.current && !themeRef.current.contains(target)) setThemeOpen(false);
      if (headingLevelOpen && headingLevelRef.current && !headingLevelRef.current.contains(target)) setHeadingLevelOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [templateOpen, codeThemeOpen, fontFamilyOpen]);

  // Code appearance settings
  useEffect(() => {
    localStorage.setItem('macos-code-block', String(macosCodeBlock));
    applyMacosCodeBlockStyle(macosCodeBlock);
    window.dispatchEvent(new CustomEvent('article-theme-changed'));
  }, [macosCodeBlock]);

  useEffect(() => {
    localStorage.setItem('first-line-indent', String(firstLineIndent));
    localStorage.setItem('justify-align', String(justifyAlign));
    applyTextStyle(firstLineIndent, justifyAlign);
    window.dispatchEvent(new CustomEvent('article-theme-changed'));
  }, [firstLineIndent, justifyAlign]);

  useEffect(() => {
    localStorage.setItem("heading-deco-config", JSON.stringify(headingConfig));
    applyHeadingDecorations(headingConfig || {});
    window.dispatchEvent(new CustomEvent('article-theme-changed'));
  }, [headingConfig]);

  useEffect(() => {
    localStorage.setItem('bg-pattern', bgPattern);
    applyBgPattern(bgPattern);
    window.dispatchEvent(new CustomEvent('article-theme-changed'));
  }, [bgPattern]);

  useEffect(() => {
    localStorage.setItem("editor-accent-color", accentColor);
    applyAccentColor(accentColor);
    localStorage.setItem("editor-caption-format", captionFormat);
    applyImageCaptionFormat(captionFormat);
    window.dispatchEvent(new CustomEvent('article-theme-changed'));
  }, [accentColor, captionFormat]);

  useEffect(() => {
    localStorage.setItem("editor-custom-css", customCSS);
    applyCustomCSS(customCSS);
  }, [customCSS]);

  const currentFontLabel = FONT_PRESETS.find(f => f.value === editorFontFamily)?.label || "系统默认";

  if (!open) return null;

  return (
    <aside className="style-panel" aria-label="文章样式">
      {/* Header */}
      <div className="style-panel__header">
        <div className="style-panel__title">
          <Palette size={14} />
          <span>文章样式</span>
        </div>
        <button className="style-panel__close" onClick={onClose} aria-label="关闭">
          <X size={14} />
        </button>
      </div>

      <div className="style-panel__body">

        {/* ── 分享主题 ── */}
        <Section label="">
          <div className="style-panel__theme-toolbar">
            <CustomSelect
              value={themePlatform}
              onChange={(v) => { setThemePlatform(v); setThemePage(0); }}
              options={platformOptions}
              placeholder="分类"
            />
            <div className="style-panel__theme-search">
              <Search size={12} />
              <input type="text" placeholder="搜索..." value={themeSearch} onChange={e => setThemeSearch(e.target.value)} />
            </div>
          </div>
          <div className="style-panel__theme-pages">
            {(() => {
              const filtered = articleThemes.filter(t => {
                if (themePlatform !== 'all' && t.platform !== themePlatform) return false;
                if (!themeSearch) return true;
                const q = themeSearch.toLowerCase();
                return t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.tags.some(tag => tag.includes(q)) || t.platform.includes(q);
              });
              const perPage = 4;
              const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
              const cur = themePage >= totalPages ? 0 : themePage;
              const pageThemes = filtered.slice(cur * perPage, cur * perPage + perPage);
              return (
                <>
                  <div className="style-panel__theme-grid">
                    {pageThemes.map((t) => {
                      const v = t.vars;
                      return (
                        <button
                          key={t.id}
                          className={"style-panel__theme-card" + (t.id === articleThemeId ? " style-panel__theme-card--active" : "")}
                          onClick={() => { const _tc = t.id !== articleThemeId; setArticleThemeId(t.id); setSelectedArticleThemeId(t.id); if (_tc) { onSetEditorFontSize?.(parseInt(t.vars.fontSize)); onSetLineHeight(t.vars.lineHeight); onSetEditorParagraphGap?.(parseFloat(t.vars.paragraphGap)); onSetEditorFontFamily?.(t.vars.fontFamily); } window.dispatchEvent(new CustomEvent("article-theme-changed")); }}
                        >
                          <div className="style-panel__theme-card-name">{t.label}</div>
                          <div className="style-panel__theme-card-desc">{t.desc}</div>
                          <div className="style-panel__theme-card-strip">
                            <span style={{ background: v.bgColor, border: "1px solid " + (v.blockquoteBorder || '#ddd') }} title="背景" />
                            <span style={{ background: v.textColor }} title="正文" />
                            <span style={{ background: v.accentColor || v.linkColor }} title="强调色" />
                            <span style={{ background: v.headingColor }} title="标题" />
                            <span style={{ background: v.strongColor || v.headingColor }} title="加粗" />
                            <span style={{ background: v.markBg || '#fff3cd' }} title="高亮" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {filtered.length > perPage && (
                    <div className="style-panel__theme-pager">
                      <button className="style-panel__theme-pager-btn" disabled={cur === 0} onClick={() => setThemePage(cur - 1)}>◀</button>
                      <div className="style-panel__theme-pager-dots">
                        {Array.from({ length: totalPages }, (_, i) => (
                          <span key={i} className={"style-panel__theme-pager-dot" + (i === cur ? " style-panel__theme-pager-dot--active" : "")} onClick={() => setThemePage(i)} />
                        ))}
                      </div>
                      <button className="style-panel__theme-pager-btn" disabled={cur >= totalPages - 1} onClick={() => setThemePage(cur + 1)}>▶</button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </Section>

        <div className="style-panel__divider" />

        {/* ── 正文字体 ── */}
        <Section icon={<TextSelect size={13} />} label="正文字体" horizontal>
          <div className="style-panel__template-select" ref={fontFamilyRef}>
            <button className="style-panel__template-trigger" onClick={() => setFontFamilyOpen(o => !o)}>
              <span>{currentFontLabel}</span>
              <ChevronDown size={12} className={`style-panel__chev${fontFamilyOpen ? " style-panel__chev--open" : ""}`} />
            </button>
            {fontFamilyOpen && (
              <div className="style-panel__template-dropdown">
                {FONT_PRESETS.map((f) => (
                  <button
                    key={f.value}
                    className={`style-panel__template-option${f.value === editorFontFamily ? " style-panel__template-option--active" : ""}`}
                    onClick={() => { onSetEditorFontFamily?.(f.value); setFontFamilyOpen(false); }}
                  >
                    <div className="style-panel__template-option-name">{f.label}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ── 字号 ── */}
        <Section icon={<Type size={13} />} label="字号" horizontal>
          <div className="style-panel__chip-row">
            {[14,15,16,17,18].map(n => (
              <button key={n} className={`style-panel__chip${editorFontSize === n ? " style-panel__chip--active" : ""}`} onClick={() => onSetEditorFontSize?.(n)}>{n}</button>
            ))}
            <span className="style-panel__chip-unit">{editorFontSize}px</span>
          </div>
          <div className="style-panel__slider-row" style={{marginTop:4}}>
          </div>
        </Section>
        {/* ── 行距 ── */}
        <Section icon={<AlignLeft size={13} />} label="行距" horizontal>
          <div className="style-panel__chip-row">
            {[1.5,1.6,1.75,2.0].map(n => (
              <button key={n} className={`style-panel__chip${Math.abs(lineHeight - n) < 0.01 ? " style-panel__chip--active" : ""}`} onClick={() => onSetLineHeight(n)}>{n.toFixed(2)}</button>
            ))}
            <span className="style-panel__slider-value">{lineHeight.toFixed(2)}</span>
          </div>
          <div className="style-panel__slider-row" style={{marginTop:4}}>
            <input type="range" min={1.0} max={3.0} step={0.05} value={lineHeight} onChange={e => onSetLineHeight(parseFloat(e.target.value))} />
          </div>
        </Section>

        {/* ── 段间距 ── */}
        {onSetEditorParagraphGap && (
          <Section icon={<Pilcrow size={13} />} label="段间距" horizontal>
            <div className="style-panel__chip-row">
              {[1.0,1.25,1.5,2.0].map(n => (
                <button key={n} className={`style-panel__chip${Math.abs(editorParagraphGap - n) < 0.05 ? " style-panel__chip--active" : ""}`} onClick={() => onSetEditorParagraphGap(n)}>{n.toFixed(1)}</button>
              ))}
              <span className="style-panel__slider-value">{editorParagraphGap.toFixed(1)}</span>
            </div>
            <div className="style-panel__slider-row" style={{marginTop:4}}>
              <input type="range" min={0.5} max={3.0} step={0.1} value={editorParagraphGap} onChange={e => onSetEditorParagraphGap(parseFloat(e.target.value))} />
            </div>
          </Section>
        )}

        {/* ── 代码主题 ── */}
        <Section icon={<Code2 size={13} />} label="代码主题" horizontal>
          <div className="style-panel__template-select" ref={codeThemeRef}>
            <button className="style-panel__template-trigger" onClick={() => setCodeThemeOpen(o => !o)}>
              <span>{currentCodeTheme?.name || "Atom One Light"}</span>
              <ChevronDown size={12} className={`style-panel__chev${codeThemeOpen ? " style-panel__chev--open" : ""}`} />
            </button>
            {codeThemeOpen && (
              <div className="style-panel__template-dropdown">
                {codeThemes.map((t) => (
                  <button
                    key={t.id}
                    className={`style-panel__template-option${t.id === codeThemeId ? " style-panel__template-option--active" : ""}`}
                    onClick={() => { onSetCodeTheme?.(t.id); setSelectedCodeTheme(t.id); setCodeThemeOpen(false); }}
                  >
                    <div className="style-panel__template-option-name">{t.name}</div>
                    <div className="style-panel__template-option-desc">{t.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
                </Section>
        {/* ── macOS 风格代码块 ── */}
        <Section icon={<Code2 size={13} />} label="代码外观" horizontal>
          <div className="style-panel__chip-row">
            <button className={`style-panel__chip${macosCodeBlock ? " style-panel__chip--active" : ""}`} onClick={() => setMacosCodeBlock(true)}>macOS 窗口</button>
            <button className={`style-panel__chip${!macosCodeBlock ? " style-panel__chip--active" : ""}`} onClick={() => setMacosCodeBlock(false)}>默认</button>
          </div>
        </Section>
        {/* ── 首行缩进 & 两端对齐 ── */}
        <div className="style-panel__row">
          <Section icon={<AlignLeft size={13} />} label="首行缩进" className="style-panel__row-half" horizontal>
            <button className={`style-panel__toggle${firstLineIndent ? " style-panel__toggle--on" : ""}`} onClick={() => setFirstLineIndent(!firstLineIndent)} role="switch" aria-checked={firstLineIndent}>
              <span className="style-panel__toggle-knob" />
            </button>
          </Section>
          <Section icon={<AlignLeft size={13} />} label="两端对齐" className="style-panel__row-half" horizontal>
            <button className={`style-panel__toggle${justifyAlign ? " style-panel__toggle--on" : ""}`} onClick={() => setJustifyAlign(!justifyAlign)} role="switch" aria-checked={justifyAlign}>
              <span className="style-panel__toggle-knob" />
            </button>
          </Section>
        </div>




        {/* ── 主题色 ── */}
        <Section icon={<Palette size={13} />} label="主题色" horizontal>
          <div className="style-panel__chip-row" style={{flexWrap: "wrap"}}>
            {getAllAccentColors().map(c => (
              <button
                key={c.value}
                className={"style-panel__chip" + (accentColor === c.value ? " style-panel__chip--active" : "")}
                onClick={() => setAccentColor(accentColor === c.value ? "" : c.value)}
                title={c.label}
              >
                <span style={{display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: c.value, marginRight: 4, verticalAlign: "middle"}} />
                {c.label}
              </button>
            ))}
            <button
              className={"style-panel__chip" + (!accentColor ? " style-panel__chip--active" : "")}
              onClick={() => setAccentColor("")}
            >默认</button>
          </div>
        </Section>

        {/* ── 图片题注 ── */}
        <Section icon={<ImageIcon size={13} />} label="图片题注" horizontal>
          <div className="style-panel__chip-row" style={{flexWrap: "wrap"}}>
            {[["", "默认"], ["title", "仅标题"], ["alt", "仅描述"], ["filename", "文件名"], ["none", "隐藏"]].map(([v, l]) => (
              <button key={v} className={"style-panel__chip" + (captionFormat === v ? " style-panel__chip--active" : "")} onClick={() => setCaptionFormat(v)}>{l}</button>
            ))}
          </div>
        </Section>

        {/* ── 标题装饰 ── */}
        <Section icon={<Type size={13} />} label="标题装饰" horizontal className="style-panel__section--heading-deco">
          <div style={{display: "flex", flexDirection: "column", gap: 6, width: "100%"}}>
            <div className="style-panel__chip-row">
              {[["h1","H1"],["h2","H2"],["h3","H3"],["h4","H4"]].map(([v,l]) => (
                <button key={v} className={`style-panel__chip${v in headingConfig ? " style-panel__chip--active" : ""}`} onClick={() => { setHeadingConfig((prev: Record<string, string[]>) => { const n = {...prev}; if (v in n) delete n[v]; else n[v] = []; return n; }); }} style={{fontSize: 10}}>{l}</button>
              ))}
            </div>
            {Object.entries(headingConfig || {}).length > 0 && (
              <div className="style-panel__deco-per-level">
                {Object.entries(headingConfig).map(([level, decos]) => (
                  <div key={level} className="style-panel__deco-row">
                    <span className="style-panel__deco-level-label">{level.toUpperCase()}</span>
                    <div className="style-panel__chip-row" style={{flexWrap: "wrap"}}>
                      {[["underline","下划线"],["overline","上划线"],["left-bar","左竖线"],["right-bar","右竖线"],["bg-block","背景块"],["left-icon","左图标"],["badge","小标签"]].map(([k, lb]) => (
                        <button key={k} className={`style-panel__chip${decos.includes(k) ? " style-panel__chip--active" : ""}`} onClick={() => { setHeadingConfig((prev: Record<string, string[]>) => { const cur = prev[level] || []; const next = cur.includes(k) ? cur.filter((x: string) => x !== k) : [...cur, k]; return {...prev, [level]: next}; }); }} style={{fontSize: 9}}>{lb}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ── 背景花纹 ── */}
        <Section icon={<TextSelect size={13} />} label="背景花纹" horizontal>
          <div className="style-panel__chip-row">
            {['','grid','dots','stripes'].map(p => {
              const labels: Record<string,string> = {'':'纯色','grid':'网格','dots':'点阵','stripes':'条纹'};
              return <button key={p} className={`style-panel__chip${bgPattern === p ? " style-panel__chip--active" : ""}`} onClick={() => setBgPattern(p)}>{labels[p]}</button>;
            })}
          </div>
        </Section>

        {/* ── 自定义 CSS ── */}
        <Section icon={<Code2 size={13} />} label="自定义 CSS">
          <textarea
            className="style-panel__textarea"
            value={customCSS}
            onChange={e => setCustomCSS(e.target.value)}
            placeholder={"/* 示例：调整正文颜色 */\nbody { color: #333; }\n\n/* 示例：自定义引用块 */\nblockquote { border-left: 3px solid #e67e22; background: #fef9f0; }\n\n/* 示例：标题装饰 */\nh2 { border-bottom: 2px solid #3498db; padding-bottom: 6px; }\n\n/* 示例：代码块圆角 */\npre { border-radius: 12px; }\n\n/* 示例：图片圆角阴影 */\nimg { border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }"}
            rows={8}
            style={{width: "100%", fontFamily: '"SF Mono", Consolas, monospace', fontSize: 12, padding: 10, borderRadius: 8, border: "1px solid var(--border-soft)", background: "var(--bg-elev)", color: "var(--text)", resize: "vertical", lineHeight: 1.6}}
          />
        </Section>


      </div>
    </aside>
  );
}

function Section({ icon, label, children, className, horizontal }: { icon?: React.ReactNode; label: string; children: React.ReactNode; className?: string; horizontal?: boolean }) {
  return (
    <div className={`style-panel__section${className ? " " + className : ""}${horizontal ? " style-panel__section--horizontal" : ""}`}>
      <div className="style-panel__section-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="style-panel__section-content">{children}</div>
    </div>
  );
}

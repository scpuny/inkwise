import { Palette, Type, X, AlignLeft, FileText, ChevronDown, TextSelect, Code2, Pilcrow, ListOrdered } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { getAllTemplates, setSelectedTemplateId, getAllCodeThemes, setSelectedCodeTheme, applyMacosCodeBlockStyle, applyTextStyle, applyHeadingDecorations, applyBgPattern, type EditorStyleTemplate, type CodeTheme } from "../lib/editorStyles";
import { getAllThemes, getThemeById, getSelectedArticleThemeId, setSelectedArticleThemeId, isPresetTheme, type ArticleTheme } from "../lib/articleThemes";

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
  const [macosCodeBlock, setMacosCodeBlock] = useState(localStorage.getItem('macos-code-block') === 'true');
  const [firstLineIndent, setFirstLineIndent] = useState(localStorage.getItem('first-line-indent') === 'true');
  const [justifyAlign, setJustifyAlign] = useState(localStorage.getItem('justify-align') === 'true');
  const [headingLevel, setHeadingLevel] = useState(localStorage.getItem('heading-deco-level') || '');
  const [headingDecos, setHeadingDecos] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('heading-deco-styles') || '[]'); } catch { return []; }
  });
  const toggleHeadingDeco = useCallback((v: string) => {
    setHeadingDecos(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }, []);
  const [bgPattern, setBgPattern] = useState(localStorage.getItem('bg-pattern') || '');
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
  }, [macosCodeBlock]);

  useEffect(() => {
    localStorage.setItem('first-line-indent', String(firstLineIndent));
    localStorage.setItem('justify-align', String(justifyAlign));
    applyTextStyle(firstLineIndent, justifyAlign);
  }, [firstLineIndent, justifyAlign]);

  useEffect(() => {
    localStorage.setItem('heading-deco-level', headingLevel);
    localStorage.setItem('heading-deco-styles', JSON.stringify(headingDecos));
    applyHeadingDecorations(headingLevel, headingDecos);
  }, [headingLevel, headingDecos]);

  useEffect(() => {
    localStorage.setItem('bg-pattern', bgPattern);
    applyBgPattern(bgPattern);
  }, [bgPattern]);

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
            <input className="style-panel__chip-input" type="number" min={10} max={36} value={editorFontSize} onChange={e => onSetEditorFontSize?.(parseInt(e.target.value) || 15)} />
            <span className="style-panel__chip-unit">px</span>
          </div>
        </Section>
        {/* ── 行距 ── */}
        <Section icon={<AlignLeft size={13} />} label="行距" horizontal>
          <div className="style-panel__chip-row">
            {[1.5,1.6,1.75,2.0].map(n => (
              <button key={n} className={`style-panel__chip${Math.abs(lineHeight - n) < 0.01 ? " style-panel__chip--active" : ""}`} onClick={() => onSetLineHeight(n)}>{n.toFixed(2)}</button>
            ))}
            <input className="style-panel__chip-input" type="number" min={1} max={3} step={0.05} value={lineHeight} onChange={e => onSetLineHeight(parseFloat(e.target.value) || 1.75)} />
          </div>
        </Section>

        {/* ── 段间距 ── */}
        {onSetEditorParagraphGap && (
          <Section icon={<Pilcrow size={13} />} label="段间距" horizontal>
            <div className="style-panel__chip-row">
              {[1.0,1.25,1.5,2.0].map(n => (
                <button key={n} className={`style-panel__chip${Math.abs(editorParagraphGap - n) < 0.05 ? " style-panel__chip--active" : ""}`} onClick={() => onSetEditorParagraphGap(n)}>{n.toFixed(1)}</button>
              ))}
              <input className="style-panel__chip-input" type="number" min={0.5} max={3} step={0.1} value={editorParagraphGap} onChange={e => onSetEditorParagraphGap(parseFloat(e.target.value) || 1.25)} />
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




        {/* ── 标题装饰 ── */}
        <Section icon={<Type size={13} />} label="标题装饰" horizontal>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6, width: '100%'}}>
            <div className="style-panel__template-select" ref={headingLevelRef}>
              <button className="style-panel__template-trigger" onClick={() => setHeadingLevelOpen(o => !o)}>
                <span style={{color: headingLevel ? 'inherit' : 'var(--text-faint)', fontSize: 11}}>{headingLevel ? headingLevel.toUpperCase() : '标题级别'}</span>
                <ChevronDown size={11} className={`style-panel__chev${headingLevelOpen ? " style-panel__chev--open" : ""}`} />
              </button>
              {headingLevelOpen && (
                <div className="style-panel__template-dropdown">
                  {[['','关'],['h1','H1'],['h2','H2'],['h3','H3'],['h4','H4']].map(([v,l]) => (
                    <button key={v} className={`style-panel__template-option${headingLevel === v ? " style-panel__template-option--active" : ""}`} onClick={() => { setHeadingLevel(v); setHeadingLevelOpen(false); }}>{l}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="style-panel__chip-row" style={{flexWrap: 'wrap'}}>
              {[['underline','下划线'],['overline','上划线'],['left-bar','左竖线'],['right-bar','右竖线'],['bg-block','背景块'],['left-icon','左图标'],['badge','小标签']].map(([v,l]) => (
                <button key={v} className={`style-panel__chip${headingDecos.includes(v) ? " style-panel__chip--active" : ""}`} onClick={() => toggleHeadingDeco(v)} style={{fontSize: 10}}>{l}</button>
              ))}
            </div>
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

        {/* ── 分享主题 ── */}
        <Section icon={<FileText size={13} />} label="主题设置">
          <div className="style-panel__template-select" ref={themeRef}>
            <button className="style-panel__template-trigger" onClick={() => setThemeOpen(o => !o)}>
              <span>{currentArticleTheme?.label || "极简白"}</span>
              <ChevronDown size={12} className={`style-panel__chev${themeOpen ? " style-panel__chev--open" : ""}`} />
            </button>
            {themeOpen && (
              <div className="style-panel__template-dropdown">
                {articleThemes.map((t) => (
                  <button
                    key={t.id}
                    className={`style-panel__template-option${t.id === articleThemeId ? " style-panel__template-option--active" : ""}`}
                    onClick={() => { setArticleThemeId(t.id); setSelectedArticleThemeId(t.id); setThemeOpen(false); window.dispatchEvent(new CustomEvent('article-theme-changed')); }}
                  >
                    <div className="style-panel__template-option-name">{t.label}</div>
                    <div className="style-panel__template-option-desc" style={{fontSize: 10}}>{t.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {currentArticleTheme && <ThemePreview theme={currentArticleTheme} />}
        </Section>

      </div>
    </aside>
  );
}



function ThemePreview({ theme }: { theme: ArticleTheme }) {
  const v = theme.vars;
  return (
    <div style={{
      fontFamily: v.fontFamily,
      fontSize: 12,
      color: v.textColor,
      background: v.bgColor,
      border: '1px solid var(--border-soft)',
      borderRadius: 6,
      padding: '10px 12px',
      marginTop: 8,
      lineHeight: 1.6,
    }}>
      <div className="theme-preview__swatches">
        <span className="theme-preview__swatch" style={{background: v.bgColor, border: '1px solid var(--border-soft)'}} title="背景" />
        <span className="theme-preview__swatch" style={{background: v.textColor}} title="文字" />
        <span className="theme-preview__swatch" style={{background: v.headingColor}} title="标题" />
        <span className="theme-preview__swatch" style={{background: v.linkColor}} title="链接" />
        <span className="theme-preview__swatch" style={{background: v.codeBg}} title="代码背景" />
        <span className="theme-preview__swatch" style={{background: v.blockquoteBorder}} title="引用边框" />
        <span className="theme-preview__swatch" style={{background: v.blockquoteBg, border: '1px solid var(--border-soft)'}} title="引用背景" />
      </div>
      <div style={{fontWeight: 700, fontSize: 13, color: v.headingColor, margin: '6px 0 3px'}}>标题示例</div>
      <div style={{marginBottom: 4}}>这是一段正文示例文字，展示当前主题的字体和颜色效果。</div>
      <div style={{borderLeft: '3px solid ' + v.blockquoteBorder, background: v.blockquoteBg, padding: '5px 9px', margin: '4px 0', borderRadius: '0 4px 4px 0', fontSize: 11}}>
        引用文本的示例样式 · 带边框和背景色
      </div>
      <div><code style={{background: v.codeBg, color: v.codeText, padding: '2px 6px', borderRadius: 3, fontSize: 11}}>const theme = {"\"示例代码\""}</code></div>
      <div style={{marginTop: 5, fontSize: 10, color: v.textColor, opacity: 0.5}}>
        {v.fontSize}px · 行距 {v.lineHeight} · 最大宽度 {v.maxWidth}px
      </div>
    </div>
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

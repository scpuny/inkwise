import { Palette, Type, X, AlignLeft, FileText, ChevronDown, TextSelect, Code2, Pilcrow, ListOrdered } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { getAllTemplates, setSelectedTemplateId, getAllCodeThemes, setSelectedCodeTheme, type EditorStyleTemplate, type CodeTheme } from "../lib/editorStyles";

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
  const [fontFamilyOpen, setFontFamilyOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);
  const codeThemeRef = useRef<HTMLDivElement>(null);
  const fontFamilyRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!templateOpen && !codeThemeOpen && !fontFamilyOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (templateOpen && templateRef.current && !templateRef.current.contains(target)) setTemplateOpen(false);
      if (codeThemeOpen && codeThemeRef.current && !codeThemeRef.current.contains(target)) setCodeThemeOpen(false);
      if (fontFamilyOpen && fontFamilyRef.current && !fontFamilyRef.current.contains(target)) setFontFamilyOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [templateOpen, codeThemeOpen, fontFamilyOpen]);

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
        {/* ── 排版模板 ── */}
        <Section icon={<FileText size={13} />} label="排版模板">
          <div className="style-panel__template-select" ref={templateRef}>
            <button className="style-panel__template-trigger" onClick={() => setTemplateOpen(o => !o)}>
              <span>{currentTemplate?.name || "默认"}</span>
              <ChevronDown size={12} className={`style-panel__chev${templateOpen ? " style-panel__chev--open" : ""}`} />
            </button>
            {templateOpen && (
              <div className="style-panel__template-dropdown">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    className={`style-panel__template-option${t.id === editorStyleTemplateId ? " style-panel__template-option--active" : ""}`}
                    onClick={() => {
                      onSetEditorStyleTemplate(t.id);
                      setSelectedTemplateId(t.id);
                      setTemplateOpen(false);
                    }}
                  >
                    <div className="style-panel__template-option-name">{t.name}</div>
                    <div className="style-panel__template-option-desc">{t.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Section>

        <div className="style-panel__divider" />

        {/* ── 正文字体 ── */}
        <Section icon={<TextSelect size={13} />} label="正文字体">
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

        {/* ── 字号 + 行距 ── */}
        <div className="style-panel__row">
          <Section icon={<Type size={13} />} label="字号" className="style-panel__row-half">
            <div className="style-panel__slider-row">
              <input
                type="range"
                className="style-panel__slider"
                min={12}
                max={24}
                step={1}
                value={editorFontSize}
                onChange={(e) => onSetEditorFontSize?.(parseInt(e.target.value))}
              />
              <span className="style-panel__slider-value">{editorFontSize}px</span>
            </div>
          </Section>
          <Section icon={<AlignLeft size={13} />} label="行距" className="style-panel__row-half">
            <div className="style-panel__slider-row">
              <input
                type="range"
                className="style-panel__slider"
                min={1}
                max={2.5}
                step={0.05}
                value={lineHeight}
                onChange={(e) => onSetLineHeight(parseFloat(e.target.value))}
              />
              <span className="style-panel__slider-value">{lineHeight.toFixed(2)}</span>
            </div>
          </Section>
        </div>

        {/* ── 段间距 ── */}
        <div className="style-panel__divider" />
        {onSetEditorParagraphGap && (
          <Section icon={<Pilcrow size={13} />} label="段间距">
            <div className="style-panel__slider-row">
              <input
                type="range"
                className="style-panel__slider"
                min={0.5}
                max={2.5}
                step={0.1}
                value={editorParagraphGap}
                onChange={(e) => onSetEditorParagraphGap(parseFloat(e.target.value))}
              />
              <span className="style-panel__slider-value">{editorParagraphGap.toFixed(1)}</span>
            </div>
          </Section>
        )}

        {/* ── 代码主题 ── */}
        <Section icon={<Code2 size={13} />} label="代码主题">
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

        {/* ── 章节序号 ── */}
        {onApplyHeadingNumbers && (
          <Section icon={<ListOrdered size={13} />} label="章节序号">
            <button className="style-panel__action-btn" onClick={onApplyHeadingNumbers}>
              <ListOrdered size={13} />
              <span>生成章节序号</span>
            </button>
            <div className="style-panel__hint" style={{ marginTop: 4 }}>
              根据顺序自动生成 1. 2. 3. 序号（仅 ## 标题）
            </div>
          </Section>
        )}

        {/* Hint */}
        <div className="style-panel__hint">
          排版模板提供完整的字体、字号、颜色预设。下方的滑块和选项会覆盖模板中的对应值。
        </div>
      </div>
    </aside>
  );
}

function Section({ icon, label, children, className }: { icon?: React.ReactNode; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`style-panel__section${className ? " " + className : ""}`}>
      <div className="style-panel__section-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="style-panel__section-content">{children}</div>
    </div>
  );
}

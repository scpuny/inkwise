import {
  Sparkles, Bold, Italic, Underline, Strikethrough,
  Quote, List, ListOrdered, Type, Link as LinkIcon,
  Highlighter, Code2, ListTodo, SeparatorHorizontal,
  MoreHorizontal, Undo2, Redo2, Image, Search, Palette,
  PanelLeft,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAgent } from "../../lib/ai/agent";

// ── TipTap helper ──
function getEditor() {
  return window.editorInstance?.editor;
}

function isActive(cmd: string, opts?: Record<string, unknown>) {
  const ed = getEditor();
  return ed ? ed.isActive(cmd, opts || {}) : false;
}

function toggleCmd(cmd: string) {
  const ed = getEditor();
  if (!ed) return;
  switch (cmd) {
    case "h1":     ed.commands.toggleHeading({ level: 1 }); break;
    case "h2":     ed.commands.toggleHeading({ level: 2 }); break;
    case "h3":     ed.commands.toggleHeading({ level: 3 }); break;
    case "bold":   ed.commands.toggleBold(); break;
    case "italic": ed.commands.toggleItalic(); break;
    case "underline": ed.commands.toggleUnderline(); break;
    case "strike": ed.commands.toggleStrike(); break;
    case "quote":  ed.commands.toggleBlockquote(); break;
    case "bullet": ed.commands.toggleBulletList(); break;
    case "ordered": ed.commands.toggleOrderedList(); break;
    case "task":   ed.commands.toggleTaskList(); break;
    case "code":   ed.commands.toggleCode(); break;
    case "codeblock": ed.commands.toggleCodeBlock(); break;
    case "hr":     ed.commands.setHorizontalRule(); break;
    case "undo":   ed.commands.undo(); break;
    case "redo":   ed.commands.redo(); break;
  }
}

// ── Button ──
function ToolBtn({
  icon, title, shortcut, active, onClick,
}: {
  icon: React.ReactNode; title: string; shortcut?: string; active?: boolean; onClick: () => void;
}) {
  const fullTitle = shortcut ? `${title} (${shortcut})` : title;
  return (
    <button
      className={`toolbar-btn${active ? " toolbar-btn--active" : ""}`}
      title={fullTitle}
      onClick={onClick}
    >
      {icon}
      {shortcut && <kbd className="toolbar-btn__shortcut">{shortcut}</kbd>}
    </button>
  );
}

// ── Link Popover ──
function LinkPopover({ onClose }: { onClose: () => void }) {
  const [href, setHref] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    const ed = getEditor();
    if (!ed) return;
    const { from, to } = ed.state.selection;
    // Pre-fill with selected text
    const selText = ed.state.doc.textBetween(from, to);
    if (selText) setText(selText);
    // Check if existing link at cursor
    const attrs = ed.getAttributes("link");
    if (attrs.href) {
      setHref(attrs.href);
      if (!selText) setText(attrs.href);
    }
  }, []);

  const handleSetLink = () => {
    const ed = getEditor();
    if (!ed) return;
    if (!href.trim()) {
      ed.commands.unsetLink();
      onClose();
      return;
    }
    const url = href.trim().startsWith("http") ? href.trim() : `https://${href.trim()}`;
    ed.commands.setLink({ href: url });
    onClose();
  };

  const handleRemoveLink = () => {
    const ed = getEditor();
    if (!ed) return;
    ed.commands.unsetLink();
    onClose();
  };

  return (
    <div className="toolbar-popover link-popover">
      <div className="link-popover__body">
        <input
          className="link-popover__input"
          type="text"
          placeholder="链接文字"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ marginBottom: 4 }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSetLink(); if (e.key === "Escape") onClose(); }}
        />
        <input
          className="link-popover__input"
          type="url"
          placeholder="https://…"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSetLink(); if (e.key === "Escape") onClose(); }}
        />
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button className="btn btn--small" onClick={handleSetLink}>确定</button>
          <button className="btn btn--small btn--secondary" onClick={handleRemoveLink}>移除链接</button>
        </div>
      </div>
    </div>
  );
}

// ── Image Popover ──
function ImagePopover({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");

  const handleApply = () => {
    const ed = getEditor();
    if (!ed || !url.trim()) { onClose(); return; }
    ed.commands.setImage({ src: url.trim() });
    onClose();
  };

  const handleFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const ed = getEditor();
        if (ed) {
          ed.commands.setImage({ src: dataUrl });
        }
        onClose();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="toolbar-popover link-popover">
      <div className="link-popover__body">
        <input
          className="link-popover__input"
          type="url"
          placeholder="图片 URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleApply(); if (e.key === "Escape") onClose(); }}
        />
        <button className="btn btn--small" onClick={handleApply}>插入 URL</button>
        <button className="btn btn--small" onClick={handleFile}>
          <Image size={12} />
          本地图片
        </button>
      </div>
    </div>
  );
}

// ── Highlight Color Popover ──
const HIGHLIGHT_COLORS = [
  { label: "清除", value: "transparent" },
  { label: "黄色", value: "#fef08a" },
  { label: "绿色", value: "#bbf7d0" },
  { label: "蓝色", value: "#bfdbfe" },
  { label: "粉色", value: "#fbcfe8" },
  { label: "橙色", value: "#fed7aa" },
];

function HighlightPopover({ onClose }: { onClose: () => void }) {
  return (
    <div className="toolbar-popover link-popover">
      <div className="link-popover__grid">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.value}
            className="highlight-swatch"
            style={{ background: c.value || "var(--bg-elev)" }}
            title={c.label}
            onClick={() => {
              const ed = getEditor();
              if (!ed) return;
              if (c.value === "transparent") ed.commands.unsetHighlight();
              else ed.commands.setHighlight({ color: c.value });
              onClose();
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Heading dropdown ──
function HeadingDropdown({ onClose }: { onClose: () => void }) {
  const headings = [
    { label: "标题 1", level: 1, style: { fontSize: "var(--text-lg)", fontWeight: 700 } },
    { label: "标题 2", level: 2, style: { fontSize: "var(--text-md)", fontWeight: 700 } },
    { label: "标题 3", level: 3, style: { fontSize: "var(--text-base)", fontWeight: 650 } },
    { label: "标题 4", level: 4, style: { fontSize: "var(--text-sm)", fontWeight: 650 } },
    { label: "正文", level: 0, style: { fontSize: "var(--text-sm)" } },
  ];

  return (
    <div className="toolbar-popover">
      <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "3px 0" }}>
        {headings.map((h) => (
          <button
            key={h.level}
            className="heading-dropdown-item"
            style={h.style}
            onClick={() => {
              if (h.level === 0) {
                getEditor()?.commands.setParagraph();
              } else {
                getEditor()?.commands.toggleHeading({ level: h.level });
              }
              onClose();
            }}
          >
            {h.label}
          </button>
        ))}
      </div>
    </div>
  );
}


// ── AI 配图 Popover ──
function DrawPopover({ onClose }: { onClose: () => void }) {
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    const editor = (window as any).editorInstance?.editor;
    if (!editor) return;
    setGenerating(true);
    setError("");
    try {
      const articleId = (window as any).__currentArticleId || "";
      const docText = editor.state.doc.textContent;
      if (!docText.trim()) {
        setError("文章为空，无法配图");
        setGenerating(false);
        return;
      }
      const { useDrawConfig } = await import("../../lib/stores/drawConfig");
      useDrawConfig.getState().setConfig({ count });
      const { emit } = await import("../../lib/events/eventBus");
      const { extractImageKeywords, insertImagesIntoArticle, getCachedImages, cacheImages } = await import("../../lib/ai/draw");
      const drawCfg = useDrawConfig.getState().config;
      
      // Check cache first (内容哈希缓存)
      const cacheConfig = { model: drawCfg.model, style: drawCfg.style, size: drawCfg.size || "1024x1024", count };
      const cached = getCachedImages(docText, cacheConfig);
      if (cached && cached.length > 0) {
        const newContent = insertImagesIntoArticle(docText, cached.map((c: any) => ({ path: c.path, altText: c.altText, targetSectionTitle: c.sectionTitle })));
        const { saveArticleContent } = await import("../../lib/storage/articles");
        await saveArticleContent(articleId, newContent);
        if ((window as any).__setEditorContent) {
          (window as any).__setEditorContent(newContent);
        }
        emit("image-gen-complete", { articleId, count: cached.length });
        setGenerating(false);
        onClose();
        return;
      }
      
      emit("image-gen-start", { articleId, total: count });
      
      const { tryInvoke } = await import("../../lib/bridge/tauri");
      const { getProvidersSync } = await import("../../lib/storage/providerModels");
      const { saveArticleContent } = await import("../../lib/storage/articles");

      const imagePlans = await extractImageKeywords(docText, count);
      if (imagePlans.length === 0) {
        emit("image-gen-complete", { articleId, count: 0 });
        setGenerating(false);
        onClose();
        return;
      }

      let providerId = "";
      for (const p of getProvidersSync()) {
        if (!p.enabled) continue;
        if (p.models.some((m: any) => m.id === drawCfg.model)) {
          providerId = p.id;
          break;
        }
      }
      if (!providerId) {
        setError("请先在设置中配置图片生成模型");
        setGenerating(false);
        return;
      }

      const savedImages = [];
      for (let i = 0; i < imagePlans.length; i++) {
        emit("image-gen-progress", { articleId, index: i, total: imagePlans.length, path: "" });
        try {
          const prompt = imagePlans[i].keywords + (drawCfg.style ? ", " + drawCfg.style : "");
          const res = await tryInvoke<any[]>("generate_image", {
            providerId,
            model: drawCfg.model,
            prompt,
            negativePrompt: drawCfg.negativePrompt || null,
            size: drawCfg.size || null,
            quality: null,
            style: null,
            n: 1,
            articleId,
            projectFolder: null,
          });
          if (res && res.length > 0) {
            savedImages.push({ path: res[0].localPath, altText: imagePlans[i].alt_text, targetSectionTitle: imagePlans[i].section_title });
          }
        } catch (e) {
          console.warn("生成图片失败:", e);
        }
      }

      if (savedImages.length > 0) {
        cacheImages(docText, cacheConfig, savedImages.map((v: any) => ({ path: v.path, altText: v.altText, sectionTitle: v.targetSectionTitle })));
        const newContent = insertImagesIntoArticle(docText, savedImages);
        await saveArticleContent(articleId, newContent);
        if ((window as any).__setEditorContent) {
          (window as any).__setEditorContent(newContent);
        }
        emit("image-gen-complete", { articleId, count: savedImages.length });
      } else {
        emit("image-gen-complete", { articleId, count: 0 });
      }
    } catch (e: any) {
      setError(e?.message || "配图失败");
    }
    setGenerating(false);
    onClose();
  };

  return (
    <div className="toolbar-popover" style={{ width: 280, padding: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>🎨 AI 配图</div>
      <div className="toolbar-popover__row">
        <label className="set-label" style={{ flex: 1 }}>配图数量</label>
        <input
          className="mem-input"
          type="number"
          min={1}
          max={6}
          style={{ width: 64 }}
          value={count}
          onChange={e => setCount(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
        />
      </div>
      {error && <div style={{ color: '#e53935', fontSize: 12, margin: '6px 0' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className="btn btn--small" onClick={onClose}>取消</button>
        <button className="btn btn--small btn--primary" onClick={handleGenerate} disabled={generating}>
          {generating ? "生成中…" : "✨ 生成配图"}
        </button>
      </div>
    </div>
  );
}

// ── Toolbar ──
export function Toolbar({
  onModeSwitch,
  editorMode,
  onStyleTemplate,
  styleTemplateId,
  onToggleFocus,
  onToggleStylePanel,
  onCloseStylePanel,
  onToggleSidebar,}: {
  onModeSwitch?: (mode: "rich" | "markdown") => void;
  editorMode?: "rich" | "markdown";
  onStyleTemplate?: (id: string) => void;
  styleTemplateId?: string;
  onToggleStylePanel?: () => void;
  onCloseStylePanel?: () => void;
  onToggleFocus?: () => void;
  onToggleSidebar?: () => void;}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { togglePanel, panelOpen } = useAgent();
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });


  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".toolbar-popover") && !target.closest(".toolbar-dropdown-btn")) {
        setLinkOpen(false); setImageOpen(false); setHighlightOpen(false); setDrawOpen(false);
        setHeadingOpen(false); setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const togglePopover = (name: string) => {
    // Close all others first
    setLinkOpen(false); setImageOpen(false); setHighlightOpen(false);
    setHeadingOpen(false); setMoreOpen(false);
    // Toggle the requested one
    switch (name) {
      case "link": setLinkOpen((o) => !o); break;
      case "image": setImageOpen((o) => !o); break;
      case "draw": setDrawOpen((o) => !o); break;
      case "highlight": setHighlightOpen((o) => !o); break;
      case "heading": setHeadingOpen((o) => !o); break;
      case "more": setMoreOpen((o) => !o); break;
    }
  };

  return (
    <div className="toolbar">
      {/* AI Quick Actions */}
      <div className="toolbar__group toolbar__group--ai">
        <button
          className="toolbar-btn"
          onClick={onToggleSidebar}
          title="侧边栏 (Ctrl+\\)"
        >
          <PanelLeft size={14} />
        </button>
        <button
          className={`toolbar-btn${panelOpen ? " toolbar-btn--active" : ""}`}
          onClick={() => { onCloseStylePanel?.(); togglePanel(); }}
          title="Agent 面板 (Ctrl+Shift+\)"
        >
          <Sparkles size={14} />
          <span className="toolbar-btn__label">AI</span>
        </button>
        <button
          className="toolbar-btn"
          title="文章样式面板"
          onClick={onToggleStylePanel}
        >
          <Palette size={14} />
        </button>
        <span className="toolbar__divider" />
      </div>
      
      {/* Left: History + Headings + Format */}
      <div className="toolbar__group">
        {/* History */}
        <ToolBtn icon={<Undo2 size={14} />} title="撤销" shortcut="⌘Z" onClick={() => toggleCmd("undo")} />
        <ToolBtn icon={<Redo2 size={14} />} title="重做" shortcut="⌘⇧Z" onClick={() => toggleCmd("redo")} />
        <span className="toolbar__divider" />

        {/* Heading */}
        <div style={{ position: "relative" }}>
          <button
            className="toolbar-btn toolbar-dropdown-btn"
            title="段落样式"
            onClick={() => togglePopover("heading")}
          >
            <Type size={14} />
          </button>
          {headingOpen && <HeadingDropdown onClose={() => setHeadingOpen(false)} />}
        </div>

        <span className="toolbar__divider" />

        {/* Text formatting */}
        <ToolBtn icon={<Bold size={14} />} title="加粗" shortcut="⌘B" onClick={() => toggleCmd("bold")} active={isActive("bold")} />
        <ToolBtn icon={<Italic size={14} />} title="斜体" shortcut="⌘I" onClick={() => toggleCmd("italic")} active={isActive("italic")} />
        <ToolBtn icon={<Underline size={14} />} title="下划线" shortcut="⌘U" onClick={() => toggleCmd("underline")} active={isActive("underline")} />
        <ToolBtn icon={<Strikethrough size={14} />} title="删除线" shortcut="⌘⇧S" onClick={() => toggleCmd("strike")} active={isActive("strike")} />
        <span className="toolbar__divider" />

        {/* Highlight */}
        <div style={{ position: "relative" }}>
          <button
            className="toolbar-btn toolbar-dropdown-btn"
            title="高亮"
            onClick={() => togglePopover("highlight")}
          >
            <Highlighter size={14} />
          </button>
          {highlightOpen && <HighlightPopover onClose={() => setHighlightOpen(false)} />}
        </div>
      </div>

      {/* Middle: Blocks + Insert */}
      <div className="toolbar__group">
        <ToolBtn icon={<Quote size={14} />} title="引用" shortcut="⌘⇧." onClick={() => toggleCmd("quote")} active={isActive("blockquote")} />
        <ToolBtn icon={<List size={14} />} title="无序列表" shortcut="⌘⇧8" onClick={() => toggleCmd("bullet")} active={isActive("bulletList")} />
        <ToolBtn icon={<ListOrdered size={14} />} title="有序列表" shortcut="⌘⇧7" onClick={() => toggleCmd("ordered")} active={isActive("orderedList")} />
        <span className="toolbar__divider" />

        <>
          <div style={{ position: "relative" }}>
            <button
              className="toolbar-btn toolbar-dropdown-btn"
              title="插入"
              onClick={() => togglePopover("image")}
            >
              <Image size={14} />
            </button>
            {imageOpen && <ImagePopover onClose={() => setImageOpen(false)} />}
          </div>
          <div style={{ position: "relative" }}>
            <ToolBtn icon={<LinkIcon size={14} />} title="链接" shortcut="⌘K" onClick={() => togglePopover("link")} active={linkOpen || isActive("link")} />
            {linkOpen && <LinkPopover onClose={() => setLinkOpen(false)} />}
          </div>
          <ToolBtn icon={<Code2 size={14} />} title="代码" shortcut="⌘E" onClick={() => toggleCmd("code")} active={isActive("code")} />
        </>
      </div>

      {/* "More" menu — always visible, content changes when AI dock is open */}
      <div className="toolbar__group">
        <div style={{ position: "relative" }}>
          <button
            className="toolbar-btn toolbar-dropdown-btn"
            title="更多工具"
            onClick={() => togglePopover("more")}
          >
            <MoreHorizontal size={14} />
          </button>
          {moreOpen && (
            <div className="toolbar-popover toolbar-more-menu">
              <>
                <button className="toolbar-more-menu__item" onClick={() => { toggleCmd("codeblock"); setMoreOpen(false); }}>
                  <Code2 size={14} /><span>代码块</span>
                </button>
                <button className="toolbar-more-menu__item" onClick={() => { toggleCmd("task"); setMoreOpen(false); }}>
                  <ListTodo size={14} /><span>任务列表</span>
                </button>
              </>
            </div>
          )}
          </div>                {/* Style panel toggle */}


        {/* Editor mode switch */}
        {onModeSwitch && (
          <button
            className={`mode-switch-btn${editorMode === "markdown" ? " mode-switch-btn--active" : ""}`}
            title="切换 Markdown / 富文本"
            onClick={() => onModeSwitch(editorMode === "markdown" ? "rich" : "markdown")}
          >
            {editorMode === "markdown" ? <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>&lt;&gt;</span> : <Type size={13} />}
          </button>
        )}



        {/* Focus mode */}
        <button
          className="toolbar-btn"
          onClick={() => onToggleFocus?.()}
          title="焦点模式"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
        <span className="toolbar__divider" />

        <button
          ref={searchBtnRef}
          className={`toolbar-btn${searchOpen ? " toolbar-btn--active" : ""}`}
          title="查找替换"
          onClick={() => { setSearchOpen((o) => !o); setLinkOpen(false); }}
        >
          <Search size={14} />
        </button>
      </div>

      {/* ── Search/Replace floating popover ── */}
      {searchOpen && <SearchReplaceBar onClose={() => setSearchOpen(false)} anchorRef={searchBtnRef} />}
    </div>
  );
}

// ── Search & Replace Bar (floating popover) ──
function SearchReplaceBar({ onClose, anchorRef }: { onClose: () => void; anchorRef: React.RefObject<HTMLButtonElement | null> }) {
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; right: number }>({ left: 0, top: 0, right: 0 });

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ left: 0, right: window.innerWidth - rect.right, top: rect.bottom + 4 });
  }, [anchorRef]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".search-replace-bar") && !t.closest(".toolbar-btn")) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSearch = () => {
    if (!query.trim()) return;
    const ed = getEditor();
    if (!ed) return;
    // Use browser find
    (window as any).find(query);
  };

  const handleReplace = () => {
    if (!query.trim()) return;
    (window as any).find(query, false, false, true);
    document.execCommand("replace", false, replace);
  };

  const handleReplaceAll = () => {
    const ed = getEditor();
    if (!ed || !query.trim()) return;
    const html = ed.getHTML();
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    ed.commands.setContent(html.replace(new RegExp(escaped, "gi"), replace));
  };

  if (!anchorRef.current) return null;
  return createPortal(
    <div ref={barRef} className="search-replace-bar" style={{ position: "fixed", right: pos.right, top: pos.top }}>
      <div className="search-replace-bar__row">
        <input
          className="search-replace-bar__input"
          type="text"
          placeholder="查找…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
        />
        <input
          className="search-replace-bar__input search-replace-bar__input--replace"
          type="text"
          placeholder="替换为…"
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
        />
      </div>
      <div className="search-replace-bar__actions">
        <button className="btn btn--small" onClick={handleSearch}>查找</button>
        <button className="btn btn--small" onClick={handleReplace}>替换</button>
        <button className="btn btn--small" onClick={handleReplaceAll}>全部替换</button>
        <button className="btn btn--small btn--danger" onClick={onClose}>关闭</button>
      </div>
    </div>,
    document.body,
  );
}

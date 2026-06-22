import { useEffect, useLayoutEffect, useCallback, useRef, useState } from "react";
import { useEditor, EditorContent as TipTapEditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import Link from "@tiptap/extension-link";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { X, Loader2 } from "lucide-react";
import { applyEditorStyle, resetEditorStyle, applyCodeTheme, type EditorStyleTemplate } from "../lib/editorStyles";
import { InlineGhostText } from "./InlineGhostText";

export type EditorMode = "rich" | "markdown";

export interface EditorContentProps {
  content?: string;
  aiResponse?: string | null;
  sending?: boolean;
  onCancelStream?: () => void;
  streamElapsed?: number;
  streamError?: string | null;
  onChange?: (content: string, mode?: EditorMode) => void;
  onClearResponse?: () => void;
  onInsertResponse?: (text: string) => void;
  mode?: EditorMode;
  lineHeight?: number;
  paragraphGap?: string;
  onOutlineChange?: (items: OutlineItem[]) => void;
  styleTemplate?: EditorStyleTemplate;
  /** Font size override (px), applied on top of template CSS */
  editorFontSize?: number;
  /** Editor max-width override (px), applied on top of template CSS */
  editorMaxWidth?: number;
  /** Font family override */
  editorFontFamily?: string;
  /** Paragraph gap override (em) */
  editorParagraphGap?: number;
  /** Code theme ID */
  codeThemeId?: string;
  onCodeThemeChange?: (id: string) => void;
  showHeadingNumber?: boolean;
}

export interface OutlineItem {
  id: string;
  text: string;
  level: number;
}

function parseOutlineFromMarkdown(content: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  const lines = content.split("\n");
  let idCounter = 0;
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      items.push({
        id: `heading-${idCounter++}`,
        text: match[2].trim(),
        level: match[1].length,
      });
    }
  }
  return items;
}

/** Check if a string looks like HTML (starts with a tag) */
function isHTML(str: string): boolean {
  return /^\s*<(?:!DOCTYPE|html|head|body|div|p|h[1-6]|ul|ol|li|table|blockquote|pre|section|article|main)\b/i.test(str);
}

export function EditorContent({
  content,
  aiResponse,
  sending,
  onCancelStream,
  streamElapsed,
  streamError,
  onChange,
  onClearResponse,
  onInsertResponse,
  mode = "rich",
  lineHeight = 1.75,
  paragraphGap = "1.25em",
  onOutlineChange,
  styleTemplate,
  editorFontSize,
  editorMaxWidth,
  editorFontFamily,
  editorParagraphGap,
  codeThemeId,
  showHeadingNumber = false,
}: EditorContentProps) {
  const editorModeRef = useRef<EditorMode>(mode);
  const prevMdRef = useRef<string | undefined>(undefined);
  const lastContentFromProps = useRef<string>("");
  const outlineTimer = useRef<any>(undefined);
  const [rawMd, setRawMd] = useState("");

  // Debounced outline sync
  const updateOutline = useCallback((content: string) => {
    if (onOutlineChange) {
      const items = parseOutlineFromMarkdown(content);
      if (outlineTimer.current) clearTimeout(outlineTimer.current);
      outlineTimer.current = setTimeout(() => onOutlineChange(items), 300);
    }
  }, [onOutlineChange]);

  // Unified: always emit markdown
  const handleTransaction = useCallback(() => {
    if (!onChange) return;
    const editor = window.editorInstance?.editor;
    if (!editor) return;

    const md = editor.getMarkdown();
    if (md !== prevMdRef.current) {
      prevMdRef.current = md;
      onChange(md, editorModeRef.current);
    }
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
      }),
      Underline,
      CodeBlockLowlight.configure({
        lowlight: createLowlight(common),
      }),
      Placeholder.configure({
        placeholder: mode === "markdown" ? "使用 Markdown 语法写作…" : "开始写作…",
      }),
      Markdown,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "tiptap-link" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: "tiptap-image",
        },
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "tiptap",
        spellcheck: "true",
      },
      handlePaste: (_view, event) => {
        // Handle image paste
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string;
              // Insert as base64 image - in production, upload to backend
              const editor = window.editorInstance?.editor;
              if (editor) {
                editor.chain().focus().setImage({ src: dataUrl }).run();
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string;
              const editor = window.editorInstance?.editor;
              if (editor) {
                editor.chain().focus().setImage({ src: dataUrl }).run();
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
    },
    onTransaction: handleTransaction,
    onUpdate: ({ editor }) => {
      const md = editor.getMarkdown();
      updateOutline(md);
    },
  });

  // Sync content from props (initial load or article switch)
  useEffect(() => {
    if (!editor || content === undefined) return;

    const currentMd = editor.getMarkdown();
    const cleanCurrent = (currentMd || "").replace(/\s+$/, "");
    const cleanContent = (content || "").replace(/\s+$/, "");

    // Diff check: only sync when content prop differs from editor content
    // AND the content prop has actually changed to something new (avoids re-syncing
    // after user edits when the parent re-renders with the same prop value)
    if (cleanCurrent !== cleanContent && lastContentFromProps.current !== content) {
      const newContent = content || "";
      // Markdown 内容需明确指定 contentType 让 @tiptap/markdown 解析
      if (isHTML(newContent)) {
        editor.commands.setContent(newContent);
      } else {
        editor.commands.setContent(newContent, { contentType: "markdown" as any });
      }
      prevMdRef.current = content;
      lastContentFromProps.current = content;

      updateOutline(content);
    }
  }, [editor, content]);

  // Sync editor mode changes
  useEffect(() => {
    if (!editor || mode === editorModeRef.current) return;
    editorModeRef.current = mode;

    if (mode === "rich") {
      // Switching FROM markdown TO rich: push textarea content into editor
      const mdContent = rawMd || content || "";
      if (isHTML(mdContent)) {
        editor.commands.setContent(mdContent);
      } else {
        editor.commands.setContent(mdContent, { contentType: "markdown" as any });
      }
    } else {
      // Switching FROM rich TO markdown: sync textarea with current editor state
      const currentMd = editor.getMarkdown();
      setRawMd(currentMd);
      prevMdRef.current = currentMd;
      onChange?.(currentMd, "markdown");
    }
  }, [editor, mode, rawMd, content, onChange]);

  // Push placeholder updates on mode change
  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find((e: any) => e.name === "placeholder");
    if (ext) {
      ext.options.placeholder = mode === "markdown" ? "使用 Markdown 语法写作…" : "开始写作…";
    }
  }, [editor, mode]);

  // Apply style template — inject full CSS into a <style> tag
  useEffect(() => {
    if (styleTemplate) {
      applyEditorStyle(styleTemplate);
    } else {
      resetEditorStyle();
    }
  }, [styleTemplate]);

  // Dynamic overrides for font-size, max-width, line-height on top of template CSS
  const overrideTagRef = useRef<HTMLStyleElement | null>(null);
  useEffect(() => {
    if (!overrideTagRef.current) {
      overrideTagRef.current = document.createElement("style");
      overrideTagRef.current.id = "editor-style-overrides";
      document.head.appendChild(overrideTagRef.current);
    }
    const tag = overrideTagRef.current;
    const parts: string[] = [];
    if (editorFontSize) parts.push(`font-size: ${editorFontSize}px`);
    if (editorMaxWidth) parts.push(`max-width: ${editorMaxWidth}px`);
    parts.push(`line-height: ${lineHeight}`);
    // paragraph gap + heading numbering
    let cssText = `.editor-container .tiptap { ${parts.join("; ")}; }\n`;
    if (showHeadingNumber) {
      cssText += `.editor-container .tiptap { counter-reset: h1-counter; }
      .editor-container .tiptap h1 { counter-reset: h2-counter; }
      .editor-container .tiptap h2 { counter-reset: h3-counter; }
      .editor-container .tiptap h3 { counter-reset: h4-counter; }
      .editor-container .tiptap h1:before { counter-increment: h1-counter; content: counter(h1-counter) ". "; color: var(--accent); font-weight: 700; }
      .editor-container .tiptap h2:before { counter-increment: h2-counter; content: counter(h1-counter) "." counter(h2-counter) " "; color: var(--accent); }
      .editor-container .tiptap h3:before { counter-increment: h3-counter; content: counter(h1-counter) "." counter(h2-counter) "." counter(h3-counter) " "; color: var(--accent); }
      .editor-container .tiptap h4:before { counter-increment: h4-counter; content: counter(h1-counter) "." counter(h2-counter) "." counter(h3-counter) "." counter(h4-counter) " "; color: var(--accent); }\n`;
    }
    tag.textContent = cssText;
  }, [editorFontSize, editorMaxWidth, lineHeight, editorFontFamily, editorParagraphGap, showHeadingNumber]);

  // Code theme
  useEffect(() => {
    if (codeThemeId) {
      applyCodeTheme(codeThemeId);
    }
  }, [codeThemeId]);

  // Apply font-family + paragraph gap via !important injected style
  const [fontStyleTag, setFontStyleTag] = useState<HTMLStyleElement | null>(null);
  useEffect(() => {
    // Create or reuse a dedicated style tag for font-family (with !important to beat everything)
    let tag = document.getElementById('editor-font-style') as HTMLStyleElement;
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'editor-font-style';
      document.head.appendChild(tag);
    }
    const rules: string[] = [];
    if (editorFontFamily) {
      rules.push(`.tiptap, .tiptap * { font-family: ${editorFontFamily} !important; }`);
    }
    if (editorParagraphGap !== undefined) {
      rules.push(`.tiptap p { margin-bottom: ${editorParagraphGap}em !important; }`);
    }
    tag.textContent = rules.join('\n');
  }, [editorFontFamily, editorParagraphGap]);

  // Expose editor globally
  useEffect(() => {
    window.editorInstance = { editor };
    // Expose insert method for ghost text
    (window as any).__insertGhostContent = (content: string) => {
      editor?.commands.insertContent(content);
    };
    return () => { window.editorInstance = undefined; };
  }, [editor]);

  // AI insert at cursor position
  const handleInsertResponse = useCallback(() => {
    if (!aiResponse || !editor) return;
    const lines = aiResponse.split("\n");
    const nodes = lines.map((line) => ({
      type: "paragraph",
      content: line.trim() ? [{ type: "text", text: line }] : [],
    }));
    editor.commands.insertContent(nodes);
    onClearResponse?.();
    onInsertResponse?.(aiResponse);
  }, [aiResponse, editor, onClearResponse, onInsertResponse]);

  // Handle raw markdown textarea change (markdown mode)
  const handleRawMdChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawMd(val);
    prevMdRef.current = val;
    onChange?.(val, "markdown");
    updateOutline(val);
  }, [onChange, updateOutline]);

  if (!editor) {
    return (
      <main className="editor-main" id="editorMain">
        <div className="editor-container">
          <div className="editor-skeleton">
            <div className="editor-skeleton__line editor-skeleton__line--title" />
            <div className="editor-skeleton__line editor-skeleton__line--short" />
            <div className="editor-skeleton__line" />
            <div className="editor-skeleton__line" />
            <div className="editor-skeleton__line editor-skeleton__line--medium" />
            <div className="editor-skeleton__spacer" />
            <div className="editor-skeleton__line" />
            <div className="editor-skeleton__line editor-skeleton__line--long" />
            <div className="editor-skeleton__line editor-skeleton__line--short" />
            <div className="editor-skeleton__line" />
            <div className="editor-skeleton__line editor-skeleton__line--medium" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="editor-main" id="editorMain">
      {mode === "rich" ? (
        /* Rich Text — TipTap WYSIWYG */
        <div
          className="editor-container"
          style={{ "--line-height": lineHeight, "--paragraph-gap": paragraphGap } as React.CSSProperties}
        >
          <TipTapEditorContent editor={editor} />
          {/* Ghost text overlay */}
          <InlineGhostText />
        </div>
      ) : (
        /* Markdown — raw textarea source view */
        <div className="editor-container editor-container--markdown">
          <textarea
            className="editor-markdown-source"
            value={rawMd}
            onChange={handleRawMdChange}
            spellCheck={true}
          />
        </div>
      )}

      {/* AI response (legacy, for non-ghost mode) */}
      {aiResponse && !sending && (
        <div className="ai-inline-suggestion">
          <div className="ai-inline-suggestion__card">
            <hr className="ai-inline-suggestion__divider" />
            <div className="ai-inline-suggestion__text" style={{ whiteSpace: "pre-wrap" }}>{aiResponse}</div>
            <div className="ai-inline-suggestion__actions">
              <button className="ai-inline-suggestion__key-hint" onClick={handleInsertResponse}>
                <kbd>↩</kbd> 插入到文档
              </button>
              <button className="ai-inline-suggestion__key-hint" onClick={onClearResponse}>
                <X size={12} /> 忽略
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI thinking / streaming */}
      {sending && (
        <div className="ai-inline-suggestion--thinking">
          <div className="ai-inline-suggestion__thinking">
            <span className="ai-inline-suggestion__pulse">AI</span>
            <span>
              {streamElapsed !== undefined && streamElapsed > 0
                ? `正在生成… ${(streamElapsed / 1000).toFixed(1)}s`
                : '正在思考中…'}
            </span>
            {onCancelStream && (
              <button
                className="ai-inline-suggestion__stop-btn"
                onClick={onCancelStream}
                title="停止生成"
                aria-label="停止生成"
              >
                <span className="ai-inline-suggestion__stop-icon" />
              </button>
            )}
          </div>
          {streamError && (
            <div className="ai-inline-suggestion__error">
              {streamError}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

declare global {
  interface Window {
    editorInstance?: { editor: any };
  }
}

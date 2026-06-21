import { useEffect, useLayoutEffect, useCallback, useRef, useState } from "react";
import { useEditor, EditorContent as TipTapEditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import Link from "@tiptap/extension-link";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { X, Loader2 } from "lucide-react";
import { applyEditorStyle, resetEditorStyle, type EditorStyleTemplate } from "../lib/editorStyles";
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
}: EditorContentProps) {
  const editorModeRef = useRef<EditorMode>(mode);
  const prevMdRef = useRef<string | undefined>(undefined);
  const syncFromProps = useRef(true);
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
        allowBase64: false,
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
    if (!syncFromProps.current) return;

    const currentMd = editor.getMarkdown();
    const cleanCurrent = currentMd.replace(/\s+$/, "");
    const cleanContent = (content || "").replace(/\s+$/, "");

    if (cleanCurrent !== cleanContent) {
      editor.commands.setContent(isHTML(content) ? content : content || "");
      prevMdRef.current = content;
    }
    syncFromProps.current = false;
  }, [editor, content]);

  // Sync editor mode changes
  useEffect(() => {
    if (!editor || mode === editorModeRef.current) return;
    editorModeRef.current = mode;

    if (mode === "rich") {
      // Switching FROM markdown TO rich: push textarea content into editor
      editor.commands.setContent(rawMd || content || "");
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

  // Expose editor globally
  useEffect(() => {
    window.editorInstance = { editor };
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

import { useEffect, useLayoutEffect, useCallback, useRef } from "react";
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
import { Sparkles, X, Loader2 } from "lucide-react";

export type EditorMode = "rich" | "markdown";

export interface EditorContentProps {
  content?: string;
  aiResponse?: string | null;
  sending?: boolean;
  onChange?: (content: string, mode?: EditorMode) => void;
  onClearResponse?: () => void;
  onInsertResponse?: (text: string) => void;
  mode?: EditorMode;
  lineHeight?: number;
  paragraphGap?: string;
  onOutlineChange?: (items: OutlineItem[]) => void;
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

export function EditorContent({
  content,
  aiResponse,
  sending,
  onChange,
  onClearResponse,
  onInsertResponse,
  mode = "rich",
  lineHeight = 1.75,
  paragraphGap = "1.25em",
  onOutlineChange,
}: EditorContentProps) {
  const editorModeRef = useRef<EditorMode>(mode);
  const prevContentRef = useRef<string | undefined>(undefined);
  const syncFromProps = useRef(true);
  const outlineTimer = useRef<any>(undefined);

  // Debounced outline sync
  const updateOutline = useCallback((content: string) => {
    if (onOutlineChange) {
      const items = parseOutlineFromMarkdown(content);
      if (outlineTimer.current) clearTimeout(outlineTimer.current);
      outlineTimer.current = setTimeout(() => onOutlineChange(items), 300);
    }
  }, [onOutlineChange]);

  const handleTransaction = useCallback(() => {
    if (!onChange) return;
    const editor = window.editorInstance?.editor;
    if (!editor) return;

    if (editorModeRef.current === "rich") {
      const html = editor.getHTML();
      if (html !== prevContentRef.current) {
        prevContentRef.current = html;
        onChange(html, "rich");
      }
    } else {
      const md = editor.getMarkdown();
      onChange(md, "markdown");
    }
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false, // handled separately
      }),
      Underline,
      Placeholder.configure({
        placeholder: "开始写作…",
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
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "tiptap",
        spellcheck: "true",
      },
    },
    onUpdate: () => handleTransaction(),
    onSelectionUpdate: () => handleTransaction(),
  });

  // Sync content from props (article switching)
  useLayoutEffect(() => {
    if (!editor || !editorModeRef.current) return;

    if (editorModeRef.current === "markdown") {
      editor.commands.setContent(content || "", {
        parseOptions: { preserveWhitespace: true },
      });
    } else {
      const currentHTML = editor.getHTML();
      if (currentHTML !== (content || "") && content !== undefined) {
        editor.commands.setContent(content);
      }
    }
    syncFromProps.current = false;
  }, [editor, content]);

  // Handle mode switching
  useEffect(() => {
    if (!editor || mode === editorModeRef.current) return;
    editorModeRef.current = mode;

    if (mode === "markdown") {
      const md = editor.getMarkdown();
      editor.commands.setContent(md);
    } else {
      if (content) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, mode, content]);

  // Expose editor globally for Toolbar
  useEffect(() => {
    window.editorInstance = { editor };
    return () => { window.editorInstance = undefined; };
  }, [editor]);

  // Outline sync from markdown content
  useEffect(() => {
    if (mode === "markdown" && editor) {
      updateOutline(content || "");
    }
  }, [content, mode, editor, updateOutline]);

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

  if (!editor) {
    return (
      <main className="editor-main" id="editorMain">
        <div className="tiptap editor-empty-state" style={{ lineHeight, "--paragraph-gap": paragraphGap } as React.CSSProperties}>
          <p>编辑器加载中…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="editor-main" id="editorMain">
      <div
        className="editor-container"
        style={{ "--line-height": lineHeight, "--paragraph-gap": paragraphGap } as React.CSSProperties}
      >
        <TipTapEditorContent editor={editor} />
      </div>

      {/* AI loading */}
      {sending && (
        <div className="ai-inline-suggestion ai-inline-suggestion--loading" style={{ marginBottom: 24 }}>
          <div className="ai-inline-suggestion__actions" style={{ justifyContent: "center" }}>
            <Loader2 size={16} className="composer__spinner" />
            <span style={{ color: "var(--fg-dim)", fontSize: 13 }}>AI 思考中…</span>
          </div>
        </div>
      )}

      {/* AI response */}
      {aiResponse && !sending && (
        <div className="ai-inline-suggestion" style={{ marginBottom: 24 }}>
          <hr className="ai-inline-suggestion__divider" />
          <div className="ai-inline-suggestion__text" style={{ whiteSpace: "pre-wrap" }}>{aiResponse}</div>
          <div className="ai-inline-suggestion__actions">
            <button className="ai-inline-suggestion__key-hint" onClick={handleInsertResponse}>
              <kbd>↩</kbd> 插入到文档
            </button>
            <button className="ai-inline-suggestion__key-hint" onClick={onClearResponse}>
              <X size={12} /> 忽略
            </button>
            <button className="ai-inline-suggestion__key-hint" onClick={() => {}}>
              <Sparkles size={12} /> 换一个
            </button>
          </div>
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

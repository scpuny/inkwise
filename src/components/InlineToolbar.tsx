// InlineToolbar.tsx — 选中文本后出现的浮动 AI 工具栏
// 悬浮在选中文本上方，提供润色/改写/翻译/扩写等快捷操作

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Edit3, Languages, Maximize2, MoreHorizontal, Search } from "lucide-react";
import { useAgent } from "../lib/agent";

interface InlineAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  intent: string;
}

const ACTIONS: InlineAction[] = [
  { id: "polish", icon: <Sparkles size={13} />, label: "润色", intent: "polish" },
  { id: "rewrite", icon: <Edit3 size={13} />, label: "改写", intent: "rewrite" },
  { id: "translate", icon: <Languages size={13} />, label: "翻译", intent: "translate" },
  { id: "expand", icon: <Maximize2 size={13} />, label: "扩写", intent: "expand" },
  { id: "analysis", icon: <Search size={13} />, label: "分析", intent: "analysis" },
];

export function InlineToolbar() {
  const { execute, isProcessing, openPanel, setPanelTab } = useAgent();
  const [enabledSkills, setEnabledSkills] = useState<string[]>(["polish","rewrite","translate","expand","analysis"]);

  useEffect(() => {
    (async () => {
      try {
        const { listSkills } = await import("../lib/skill");
        const skills = await listSkills();
        setEnabledSkills(skills.filter(s => s.enabled !== false).map(s => s.name));
      } catch {}
    })();
  }, []);

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Track selection changes in the editor only
  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      // Only respond to selections inside the editor container
      const editorContainer = document.querySelector(".editor-container");
      if (!editorContainer) { setVisible(false); return; }

      // For mouse events, check if the click originated inside the editor
      if (e.type === "mouseup") {
        const target = e.target as Node;
        if (!editorContainer.contains(target)) {
          setVisible(false);
          return;
        }
      }

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setVisible(false);
        return;
      }

      // Verify the selection is inside the editor
      const editor = (window as any).editorInstance?.editor;
      if (!editor) return;

      const text = sel.toString().trim();
      if (text.length < 2) {
        setVisible(false);
        return;
      }

      // Get position from selection
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = editorContainer.getBoundingClientRect();

      // Position: above the selection, centered
      setPosition({
        top: rect.top - containerRect.top - 40,
        left: rect.left - containerRect.left + rect.width / 2,
      });

      // Try to get character offset from editor
      try {
        const { from, to } = editor.state.selection;
        setSelectionRange({ from, to });
      } catch {
        setSelectionRange(null);
      }

      setSelectedText(text);
      setVisible(true);
    };

    document.addEventListener("mouseup", handler);
    document.addEventListener("keyup", handler);
    return () => {
      document.removeEventListener("mouseup", handler);
      document.removeEventListener("keyup", handler);
    };
  }, []);

  // Get document content
  const getDocumentContent = useCallback(() => {
    const editor = (window as any).editorInstance?.editor;
    if (!editor) return "";
    return editor.getText() || "";
  }, []);

  const handleAction = useCallback((intent: string) => {
    if (!selectedText || !selectionRange) return;

    const docContent = getDocumentContent();
    const cmd = `/${intent} ${selectedText.slice(0, 40)}${selectedText.length > 40 ? "…" : ""}`;

    execute(cmd, {
      intent,
      selection: selectionRange,
      beforeContent: docContent,
    });

    setVisible(false);
    openPanel();
    setPanelTab("chat");
  }, [selectedText, selectionRange, execute, getDocumentContent, openPanel, setPanelTab]);

  const handleMore = useCallback(() => {
    setVisible(false);
    openPanel();
    setPanelTab("chat");
  }, [openPanel, setPanelTab]);

  if (!visible) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      className="inline-toolbar"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {ACTIONS.filter(a => enabledSkills.includes(a.intent) || a.intent === "analysis").map((action) => (
        <button
          key={action.id}
          className="inline-toolbar__btn"
          onClick={() => handleAction(action.intent)}
          disabled={isProcessing}
          title={action.label}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
      <div className="inline-toolbar__divider" />
      <button
        className="inline-toolbar__btn inline-toolbar__btn--more"
        onClick={handleMore}
        title="更多操作"
      >
        <MoreHorizontal size={13} />
      </button>
    </div>,
    document.querySelector(".editor-container") || document.body
  );
}

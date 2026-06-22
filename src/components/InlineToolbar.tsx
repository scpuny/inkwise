// InlineToolbar.tsx — 选中文本后出现的浮动 AI 工具栏
// 悬浮在选中文本上方，提供润色/改写/翻译/扩写等快捷操作

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Edit3, Languages, Maximize2, MoreHorizontal, Search, FileText, RotateCw, BookOpen, PenTool, Quote, ListChecks, Hash, MessageSquare } from "lucide-react";
import { useAgent } from "../lib/agent";

// Skill icon/label helpers
function getSkillIcon(name: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
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
  return icons[name] || <Sparkles size={13} />;
}
const skillLabels: Record<string, string> = {"continue-writing":"续写","rewrite":"改写","polish":"润色","translate":"翻译","academic":"学术写作","creative":"创意写作","summary":"摘要","outline":"大纲","expand":"扩写","paraphrase":"同义改写","proofread":"校对","blog":"博客","novel":"小说","headline":"标题","email":"邮件","keyword-extract":"关键词","readability":"可读性","citation":"引用"};

// 常用技能（始终显示在工具栏上），其余放入更多面板
const PRIMARY_SKILLS = ["polish", "rewrite", "translate", "expand", "analysis"];

export function InlineToolbar() {
  const { execute, isProcessing, openPanel, setPanelTab } = useAgent();
  const [toolActions, setToolActions] = useState<{id:string;intent:string;label:string}[]>([
    {id:"polish",intent:"polish",label:"润色"},
    {id:"rewrite",intent:"rewrite",label:"改写"},
    {id:"translate",intent:"translate",label:"翻译"},
    {id:"expand",intent:"expand",label:"扩写"},
    {id:"analysis",intent:"analysis",label:"分析"},
  ]);

  useEffect(() => {
    (async () => {
      try {
        const { listSkills } = await import("../lib/skill");
        const skills = await listSkills();
        const enabled = skills.filter(s => s.enabled !== false).map(s => s.name);
        const actions = enabled.filter(n => skillLabels[n] || n === "analysis").map(n => ({
          id: n, intent: n, label: skillLabels[n] || (n === "analysis" ? "分析" : n),
        }));
        // Always include analysis at the end
        if (!actions.find(a => a.intent === "analysis")) {
          actions.push({id:"analysis",intent:"analysis",label:"分析"});
        }
        setToolActions(actions);
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

  // More panel state
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreDirection, setMoreDirection] = useState<"down" | "up">("down");
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);

  // Split actions: primary visible buttons vs rest in more panel
  const { primary, secondary } = useMemo(() => {
    const p: typeof toolActions = [];
    const s: typeof toolActions = [];
    for (const a of toolActions) {
      if (PRIMARY_SKILLS.includes(a.intent)) p.push(a);
      else s.push(a);
    }
    return { primary: p, secondary: s };
  }, [toolActions]);

  const toggleMore = useCallback(() => {
    if (!moreOpen) {
      if (moreBtnRef.current) {
        const btnRect = moreBtnRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - btnRect.bottom;
        setMoreDirection(spaceBelow > 280 ? "down" : "up");
      }
    }
    setMoreOpen(o => !o);
  }, [moreOpen]);

  // Close more panel on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        morePanelRef.current && !morePanelRef.current.contains(e.target as Node) &&
        moreBtnRef.current && !moreBtnRef.current.contains(e.target as Node)
      ) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  const handleMoreAction = useCallback((intent: string) => {
    setMoreOpen(false);
    handleAction(intent);
  }, [handleAction]);

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
      style={{ top: position.top, left: position.left, transform: "translateX(-50%)" }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {primary.map((action) => (
        <button
          key={action.id}
          className="inline-toolbar__btn"
          onClick={() => handleAction(action.intent)}
          disabled={isProcessing}
          title={action.label}
        >
          {getSkillIcon(action.intent)}
          <span>{action.label}</span>
        </button>
      ))}
      {secondary.length > 0 && (
        <>
          <div className="inline-toolbar__divider" />
          <div className="inline-toolbar__more-wrap">
            <button
              ref={moreBtnRef}
              className={`inline-toolbar__btn inline-toolbar__btn--more ${moreOpen ? "is-active" : ""}`}
              onClick={toggleMore}
              title="更多操作"
            >
              <MoreHorizontal size={13} />
            </button>
            {moreOpen && (
              <div
                ref={morePanelRef}
                className={`inline-toolbar__more-panel inline-toolbar__more-panel--${moreDirection}`}
                onMouseDown={(e) => e.preventDefault()}
              >
                {secondary.map((action) => (
                  <button
                    key={action.id}
                    className="inline-toolbar__more-item"
                    onClick={() => handleMoreAction(action.intent)}
                    disabled={isProcessing}
                    title={action.label}
                  >
                    {getSkillIcon(action.intent)}
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>,
    document.querySelector(".editor-container") || document.body
  );
}

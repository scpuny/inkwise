// AgentPanel.tsx — Agent 操作面板，替代原来的 AIDock
// 三个 Tab：Chat（对话/结果） | Diff（差异对比） | History（操作历史）

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MessageSquare, GitCompare, History, X, Check, Trash2,
  Sparkles, Loader2, RefreshCw, FileDown, Edit3, Languages,
  Maximize2, Search, PenTool, ListChecks, FileText, RotateCw,
  BookOpen, Hash, Quote,
} from "lucide-react";
import { computeDiff } from "../lib/diff";
import { useAgent, getSkillDisplayLabel } from "../lib/agent";
import type { AgentSession } from "../lib/agent";

/* ─── Tab 定义 ─── */
type TabId = "chat" | "diff" | "history";

const TABS: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: "chat", icon: <MessageSquare size={13} />, label: "对话" },
  { id: "diff", icon: <GitCompare size={13} />, label: "对比" },
  { id: "history", icon: <History size={13} />, label: "历史" },
];

export function AgentPanel() {
  const {
    panelOpen, panelTab, setPanelTab, closePanel,
    sessions, isProcessing, lastError,
    acceptSession, rejectSession, removeSession,
  } = useAgent();

  const [chatInput, setChatInput] = useState("");
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions]);

  if (!panelOpen) return null;

  return (
    <aside className="agent-panel" aria-label="Agent 面板">
      {/* Header */}
      <div className="agent-panel__header">
        <div className="agent-panel__title">
          <Sparkles size={14} />
          <span>Agent</span>
        </div>
        <button className="agent-panel__close" onClick={closePanel} aria-label="关闭面板">
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="agent-panel__tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={panelTab === tab.id}
            className={`agent-panel__tab${panelTab === tab.id ? " agent-panel__tab--active" : ""}`}
            onClick={() => setPanelTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="agent-panel__body">
        {panelTab === "chat" && (
          <ChatPanel
            sessions={sessions}
            isProcessing={isProcessing}
            lastError={lastError}
            chatInput={chatInput}
            onChatInputChange={setChatInput}
            chatInputRef={chatInputRef}
            chatEndRef={chatEndRef}
          />
        )}
        {panelTab === "diff" && (
          <DiffPanel sessions={sessions} />
        )}
        {panelTab === "history" && (
          <HistoryPanel
            sessions={sessions}
            onAccept={acceptSession}
            onReject={rejectSession}
            onRemove={removeSession}
          />
        )}
      </div>
    </aside>
  );
}

/* ─── Chat Panel ─── */
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  function flushList() {
    if (listItems.length > 0) {
      elements.push(<ul key={"ul" + elements.length} style={{margin: "2px 0", paddingLeft: 16, listStyle: "none"}}>{listItems}</ul>);
      listItems = [];
    }
  }
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Heading
    const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      flushList();
      const level = hMatch[1].length;
      const style: React.CSSProperties = {fontSize: level === 1 ? 15 : level === 2 ? 14 : 13, fontWeight: 600, margin: "8px 0 4px", color: "var(--text)"};
      if (level === 1) elements.push(<h3 key={i} style={style}>{hMatch[2]}</h3>);
      else if (level === 2) elements.push(<h4 key={i} style={style}>{hMatch[2]}</h4>);
      else elements.push(<h5 key={i} style={style}>{hMatch[2]}</h5>);
      return;
    }
    // Bold
    const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
    if (boldParts.length > 1) {
      flushList();
      const children = boldParts.map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      elements.push(<p key={i} style={{margin: "2px 0", lineHeight: 1.6, fontSize: 12, color: "var(--text-secondary)"}}>{children}</p>);
      return;
    }
    // HR
    if (trimmed.startsWith("---") || trimmed.startsWith("***")) {
      flushList();
      elements.push(<hr key={i} style={{margin: "6px 0", border: "none", borderTop: "1px solid var(--border)"}} />);
      return;
    }
    // List item
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      const itemText = trimmed.slice(2);
      const bParts = itemText.split(/(\*\*[^*]+\*\*)/g);
      const children = bParts.map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      listItems.push(<li key={i} style={{fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", marginLeft: 8}}>{children}</li>);
      return;
    }
    // Empty line
    if (!trimmed) {
      flushList();
      return;
    }
    // Paragraph
    flushList();
    const bp = line.split(/(\*\*[^*]+\*\*)/g);
    const cp = bp.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    elements.push(<p key={i} style={{margin: "2px 0", lineHeight: 1.6, fontSize: 12, color: "var(--text-secondary)"}}>{cp}</p>);
  });
  flushList();
  return <>{elements}</>;
}const skillLabels: Record<string, string> = {"continue-writing":"续写","rewrite":"改写","polish":"润色","translate":"翻译","academic":"学术写作","creative":"创意写作","summary":"摘要","outline":"大纲","expand":"扩写","paraphrase":"同义改写","proofread":"校对","blog":"博客","novel":"小说","headline":"标题","email":"邮件","keyword-extract":"关键词","readability":"可读性","citation":"引用"};

// Skill icons (shared with InlineToolbar)
const skillIconMap: Record<string, React.ReactNode> = {
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

// ─── Quick Action Dropdown (replaces native select for icon support) ───
function QuickActionDropdown({
  quickSkills, isProcessing, onChatInputChange, chatInputRef, execute,
}: {
  quickSkills: string[];
  isProcessing: boolean;
  onChatInputChange: (v: string) => void;
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>;
  execute: (input: string, opts?: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (intent: string) => {
    setOpen(false);
    const editor = (window as any).editorInstance?.editor;
    if (!editor || editor.state.selection.empty) {
      onChatInputChange("/" + intent + " ");
      chatInputRef.current?.focus();
      return;
    }
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    const docContent = editor.getText() || "";
    execute("/" + intent + " " + selectedText.slice(0, 40) + (selectedText.length > 40 ? "…" : ""), {
      intent,
      selection: { from, to },
      beforeContent: docContent,
    });
  };

  return (
    <div className="agent-chat__tool-select-wrap" ref={wrapRef}>
      <button
        className="agent-chat__tool-select-btn"
        onClick={() => setOpen(!open)}
        title="快捷操作"
      >
        <Sparkles size={13} />
        <span>快捷操作</span>
      </button>
      {open && (
        <div className="agent-chat__tool-select-panel">
          {quickSkills.map((s) => (
            <button
              key={s}
              className="agent-chat__tool-select-item"
              onClick={() => handleSelect(s)}
              disabled={isProcessing}
            >
              {skillIconMap[s] || <Sparkles size={13} />}
              <span>{skillLabels[s] || s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatPanel({
  sessions, isProcessing, lastError, chatInput, onChatInputChange, chatInputRef, chatEndRef,
}: {
  sessions: AgentSession[];
  isProcessing: boolean;
  lastError: string | null;
  chatInput: string;
  onChatInputChange: (v: string) => void;
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { execute } = useAgent();
  const [quickSkills, setQuickSkills] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { listSkills } = await import("../lib/skill");
        const skills = await listSkills();
        setQuickSkills(skills.filter(s => s.enabled !== false).map(s => s.name).filter(n => skillLabels[n]));
      } catch { setQuickSkills(["polish","rewrite","translate","expand","continue-writing","proofread","paraphrase","summary"]); }
    })();
  }, []);

  const handleSend = useCallback(() => {
    if (!chatInput.trim() || isProcessing) return;
    execute(chatInput, { intent: "chat" });
    onChatInputChange("");
  }, [chatInput, isProcessing, execute, onChatInputChange]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Only show agent-mode sessions in chat
  const agentSessions = sessions.filter((s) => s.mode === "agent" || s.mode === "command");

  return (
    <div className="agent-chat">
      <div className="agent-chat__messages">
        {agentSessions.length === 0 && !isProcessing && (
          <div className="agent-chat__empty">
            <Sparkles size={24} />
            <p>在下方输入，让 AI 协助分析、研究或完成复杂写作任务</p>
          </div>
        )}

        {agentSessions.map((session) => (
          <div key={session.id} className={`agent-chat__message agent-chat__message--${session.state}`}>
            <div className="agent-chat__msg-header">
              <span className="agent-chat__intent-badge">
                {getSkillDisplayLabel(session.intent)}
              </span>
              <span className="agent-chat__time">
                {new Date(session.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="agent-chat__msg-user">
              {session.userInput}
            </div>
            {session.afterContent && (
              <div className="agent-chat__msg-response">
                <div className="agent-chat__response-text">
                  {renderMarkdown(session.afterContent)}
                </div>
                <div className="agent-chat__msg-actions">
                  {session.state === "pending" && (
                    <>
                      {!["analysis","summary","chat","readability","keyword-extract","citation","outline","headline"].includes(session.intent) && (
                        <button className="agent-chat__action agent-chat__action--accept" onClick={() => {
                          const editor = (window as any).editorInstance?.editor;
                          if (editor) editor.commands.insertContent(session.afterContent);
                        }}>
                          <Check size={12} /> 插入
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="agent-chat__message agent-chat__message--processing">
            <div className="agent-chat__thinking">
              <Loader2 size={14} className="agent-chat__spinner" />
              <span>处理中…</span>
            </div>
          </div>
        )}

        {lastError && (
          <div className="agent-chat__message agent-chat__message--error">
            <div className="agent-chat__error-text">{lastError}</div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Bottom bar (matching AICommandBar style) */}
      <div className="agent-chat__bar">
      {/* Input row: dropdown + textarea + send */}
      <div className="agent-chat__input-area">
        <QuickActionDropdown
          quickSkills={quickSkills}
          isProcessing={isProcessing}
          onChatInputChange={onChatInputChange}
          chatInputRef={chatInputRef}
          execute={execute}
        />
        <textarea
          ref={chatInputRef}
          className="agent-chat__input"
          placeholder="输入指令… 例如：帮我分析文章结构"
          rows={1}
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          onKeyDown={handleKey}
        />
        <button
          className="agent-chat__send-btn"
          disabled={!chatInput.trim() || isProcessing}
          onClick={handleSend}
        >
          {isProcessing ? (
            <Loader2 size={16} className="agent-chat__spinner" />
          ) : (
            <Sparkles size={16} />
          )}
        </button>
      </div>

      {/* Footer hints */}
      <div className="agent-chat__footer">
        <div className="agent-chat__hints">
          <span className="agent-chat__hint-key">Ctrl+Enter</span>
          <span className="agent-chat__hint-label">发送</span>
          <span className="agent-chat__hint-key">Shift+Enter</span>
          <span className="agent-chat__hint-label">换行</span>
        </div>
      </div>
      </div>

    </div>
  );
}

/* ─── Diff Panel ─── */
function DiffPanel({ sessions }: { sessions: AgentSession[] }) {
  const pendingSessions = sessions.filter((s) => s.afterContent && s.state !== "rejected");

  if (pendingSessions.length === 0) {
    return (
      <div className="agent-panel__empty">
        <GitCompare size={24} />
        <p>暂无 AI 操作记录可对比</p>
      </div>
    );
  }

  return (
    <div className="agent-diff">
      {pendingSessions.map((session) => {
        const diffLines = computeDiff(session.beforeContent, session.afterContent);
        const addCount = diffLines.filter(l => l.type === "add").length;
        const removeCount = diffLines.filter(l => l.type === "remove").length;

        return (
          <div key={session.id} className="agent-diff__item">
            <div className="agent-diff__header">
              <span className="agent-chat__intent-badge">
                {getSkillDisplayLabel(session.intent)}
              </span>
              <span className="agent-diff__stats">
                <span className="agent-diff__stat agent-diff__stat--add">+{addCount}</span>
                <span className="agent-diff__stat agent-diff__stat--remove">-{removeCount}</span>
              </span>
              {session.state === "accepted" && <span className="agent-diff__state agent-diff__state--accepted">已接受</span>}
              {session.state === "pending" && <span className="agent-diff__state agent-diff__state--pending">待处理</span>}
            </div>
            <div className="agent-diff__rows">
              {diffLines.map((line, i) => (
                <div
                  key={i}
                  className={`agent-diff__row agent-diff__row--${line.type}`}
                >
                  <span className="agent-diff__row-num">{line.lineNum + 1}</span>
                  <span className="agent-diff__row-prefix">
                    {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                  </span>
                  <span className="agent-diff__row-text">{line.text || " "}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── History Panel ─── */
function HistoryPanel({
  sessions, onAccept, onReject, onRemove,
}: {
  sessions: AgentSession[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <div className="agent-panel__empty">
        <History size={24} />
        <p>暂无操作历史</p>
      </div>
    );
  }

  return (
    <div className="agent-history">
      {[...sessions].reverse().map((session) => (
        <div key={session.id} className="agent-history__item">
          <div className="agent-history__item-header">
            <div className="agent-history__item-info">
              <span className="agent-chat__intent-badge">
                {getSkillDisplayLabel(session.intent)}
              </span>
              <span className="agent-history__item-mode">
                {session.mode === "inline" ? "内联" : session.mode === "command" ? "指令" : "Agent"}
              </span>
            </div>
            <span className="agent-history__item-time">
              {new Date(session.createdAt).toLocaleString()}
            </span>
          </div>

          <div className="agent-history__item-preview">
            输入: {session.userInput.slice(0, 80)}{session.userInput.length > 80 ? "…" : ""}
          </div>

          <div className="agent-history__item-actions">
            {session.state === "pending" ? (
              <>
                <button className="agent-history__action agent-history__action--accept" onClick={() => onAccept(session.id)}>
                  <Check size={11} /> 接受
                </button>
                <button className="agent-history__action agent-history__action--reject" onClick={() => onReject(session.id)}>
                  <X size={11} /> 拒绝
                </button>
              </>
            ) : (
              <span className={`agent-history__state agent-history__state--${session.state}`}>
                {session.state === "accepted" ? "已接受" : "已拒绝"}
              </span>
            )}
            <button className="agent-history__action agent-history__action--delete" onClick={() => onRemove(session.id)}>
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

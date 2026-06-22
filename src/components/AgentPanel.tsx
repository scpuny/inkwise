// AgentPanel.tsx — Agent 操作面板，替代原来的 AIDock
// Agent 对话面板 — 所有 AI 技能输出统一在此展示

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MessageSquare, X, Check, Trash2, History,
  Sparkles, Loader2, RefreshCw, FileDown, Edit3, Languages,
  Maximize2, Search, PenTool, ListChecks, FileText, RotateCw,
  BookOpen, Hash, Quote,
} from "lucide-react";
import { useAgent, getSkillDisplayLabel } from "../lib/agent";
import type { AgentSession } from "../lib/agent";

/* ─── Tab 定义 ─── */
type TabId = "chat" | "diff" | "history";

const TABS: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: "chat", icon: <MessageSquare size={13} />, label: "对话" },
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
        {panelTab === "history" && (
          <HistoryPanel
            sessions={sessions}
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

// ─── Thinking Timer — shows elapsed time while AI is processing ───
function ThinkingTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState("AI 思考中…");

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - start) / 1000);
      setElapsed(sec);
      if (sec > 30) setHint("仍在处理中，模型响应较慢或网络延迟…");
      else if (sec > 15) setHint("AI 生成中，请稍候…");
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}分${sec}秒` : `${sec}秒`;
  };

  return (
    <div className="agent-chat__message agent-chat__message--processing">
      <div className="agent-chat__thinking">
        <Loader2 size={14} className="agent-chat__spinner" />
        <span>{hint}</span>
        <span className="agent-chat__elapsed">{formatTime(elapsed)}</span>
      </div>
    </div>
  );
}

// ─── Quick Action Dropdown (replaces native select for icon support) ───
function QuickActionDropdown({
  quickSkills, isProcessing, onChatInputChange, chatInputRef,
}: {
  quickSkills: string[];
  isProcessing: boolean;
  onChatInputChange: (v: string) => void;
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>;
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
    let cmd = "/" + intent + " ";
    // Use DOM selection to check if text is actually selected right now
    const domSel = window.getSelection();
    const hasRealSelection = domSel && !domSel.isCollapsed && domSel.toString().trim().length > 0;
    if (editor && hasRealSelection) {
      try {
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to, " ");
        if (selectedText.trim()) cmd += selectedText;
      } catch { /* ignore */ }
    }
    onChatInputChange(cmd);
    chatInputRef.current?.focus();
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
              {getSkillIcon(s)}
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
  const { execute, cancel } = useAgent();
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
    const editor = (window as any).editorInstance?.editor;
    const docContent = editor ? editor.getText() || "" : "";
    execute(chatInput, { intent: "chat", beforeContent: docContent });
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
                          if (editor) {
                            const sel = session.selectionRange;
                            // Skills that modify selected text (use replace) vs generate new content (use insert)
                            const replaceSkills = ["polish","rewrite","translate","expand","paraphrase","proofread","academic","creative"];
                            const shouldReplace = sel && sel.from !== undefined && sel.to !== undefined && replaceSkills.includes(session.intent);
                            if (shouldReplace) {
                              // Replace selected text
                              editor.commands.deleteRange({ from: sel.from, to: sel.to });
                              editor.commands.insertContentAt(sel.from, session.afterContent);
                            } else if (sel && sel.from !== undefined) {
                              // Insert at selection position
                              editor.commands.insertContentAt(sel.from, session.afterContent);
                            } else {
                              // Fallback: insert at cursor
                              editor.commands.insertContent(session.afterContent);
                            }
                          }
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

        {isProcessing && <ThinkingTimer />}

        {lastError && (
          <div className="agent-chat__message agent-chat__message--error">
            <div className="agent-chat__error-text">
              {lastError?.length > 200 ? lastError.slice(0, 200) + "…" : lastError}
            </div>
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
          className={`agent-chat__send-btn ${isProcessing ? "agent-chat__stop-btn" : ""}`}
          disabled={!chatInput.trim() && !isProcessing}
          onClick={isProcessing ? cancel : handleSend}
          title={isProcessing ? "停止" : "发送"}
        >
          {isProcessing ? (
            <span className="agent-chat__stop-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="10" height="10" rx="2"/></svg>
            </span>
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
function HistoryPanel({
  sessions, onRemove,
}: {
  sessions: AgentSession[];
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
            <span className={`agent-history__state agent-history__state--${session.state}`}>
              {session.state === "accepted" ? "已接受" : session.state === "rejected" ? "已拒绝" : "待处理"}
            </span>
            <button className="agent-history__action agent-history__action--delete" onClick={() => onRemove(session.id)}>
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

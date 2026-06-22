// AgentPanel.tsx — Agent 操作面板，替代原来的 AIDock
// 三个 Tab：Chat（对话/结果） | Diff（差异对比） | History（操作历史）

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, GitCompare, History, X, Check, Trash2,
  Sparkles, Loader2, RefreshCw, FileDown,
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
const skillLabels: Record<string, string> = {"continue-writing":"续写","rewrite":"改写","polish":"润色","translate":"翻译","academic":"学术写作","creative":"创意写作","summary":"摘要","outline":"大纲","expand":"扩写","paraphrase":"同义改写","proofread":"校对","blog":"博客","novel":"小说","headline":"标题","email":"邮件","keyword-extract":"关键词","readability":"可读性","citation":"引用"};

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
                <div className="agent-chat__response-text">{session.afterContent}</div>
                <div className="agent-chat__msg-actions">
                  {session.state === "pending" && (
                    <>
                      <button className="agent-chat__action agent-chat__action--accept" onClick={() => {
                        // Insert into editor
                        const editor = (window as any).editorInstance?.editor;
                        if (editor) editor.commands.insertContent(session.afterContent);
                      }}>
                        <Check size={12} /> 插入
                      </button>
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
        <select
          className="agent-chat__tool-select"
          defaultValue=""
          onChange={(e) => {
            const intent = e.target.value;
            e.target.value = "";
            if (!intent) return;
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
          }}
          title="快捷操作"
        >
          <option value="" disabled>快捷操作</option>
          {quickSkills.map(s => <option key={s} value={s}>{skillLabels[s] || s}</option>)}
        </select>
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

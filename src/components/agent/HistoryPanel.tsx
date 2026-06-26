import { Trash2, History } from "lucide-react";
import { getSkillDisplayLabel } from "../../lib/ai/agent";
import type { AgentSession } from "../../lib/ai/agent";

/* ─── 操作历史面板 ─── */
export function HistoryPanel({
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

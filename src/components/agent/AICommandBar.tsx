// AICommandBar.tsx — 浮动指令条，悬浮在编辑器内
// 替代原来的底部 AIBar，聚焦时出现，失焦时消失

import { useState, useCallback, useRef, useEffect } from "react";
import {
  SendHorizonal, Sparkles, X, Brain, ArrowLeftRight, ChevronDown, History,
} from "lucide-react";
import { useAgent } from "../../lib/ai/agent";
import { IntentMenu, type IntentOption } from "./IntentMenu";
import { listSkills, type Skill } from "../../lib/storage/skill";

export function AICommandBar() {
  const {
    commandBarOpen, commandBarText, setCommandBarText,
    closeCommandBar, execute, isProcessing, cancel, panelOpen, togglePanel,
  } = useAgent();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [skills, setSkills] = useState<Skill[]>([]);

  // Focus when opened
  useEffect(() => {
    if (commandBarOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [commandBarOpen]);

  // Load skills on mount
  useEffect(() => {
    listSkills().then((s) => setSkills(s)).catch(() => {});
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommandBarText(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }, [setCommandBarText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!isProcessing && commandBarText.trim()) {
        execute(commandBarText);
      }
    }
    // Escape to close
    if (e.key === "Escape") {
      e.preventDefault();
      closeCommandBar();
    }
    // Enter alone: send with detected intent
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (!isProcessing && commandBarText.trim()) {
        execute(commandBarText);
      }
    }
  }, [commandBarText, execute, isProcessing, closeCommandBar]);

  // Detect intent from current text for display
  const intentPreview = commandBarText.startsWith("/")
    ? commandBarText.slice(1).split(/\s+/)[0]
    : null;

  if (!commandBarOpen) return null;

  return (
    <div className="ai-command-bar" onClick={(e) => e.stopPropagation()}>
      {/* Drag handle */}
      <div className="ai-command-bar__handle">
        <Sparkles size={14} />
      </div>

      {/* Input area */}
      <div className="ai-command-bar__input-area">
        {intentPreview && (
          <span className="ai-command-bar__intent-chip">{intentPreview}</span>
        )}
        <textarea
          ref={inputRef}
          className="ai-command-bar__input"
          placeholder="继续写作… 使用 / 命令或直接输入"
          rows={1}
          value={commandBarText}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
        />
        {isProcessing ? (
          <button className="ai-command-bar__btn ai-command-bar__btn--stop" onClick={cancel} title="停止生成">
            <span className="ai-command-bar__stop-icon" />
          </button>
        ) : (
          <button
            className="ai-command-bar__btn ai-command-bar__btn--send"
            disabled={!commandBarText.trim()}
            onClick={() => execute(commandBarText)}
            title="发送 (Enter)"
          >
            <SendHorizonal size={16} />
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="ai-command-bar__footer">
        <div className="ai-command-bar__hints">
          {!commandBarText.startsWith("/") && (
            <>
              <span className="ai-command-bar__hint-key">Enter</span>
              <span className="ai-command-bar__hint-label">发送 · </span>
              <span className="ai-command-bar__hint-key">Shift+Enter</span>
              <span className="ai-command-bar__hint-label">换行 · </span>
            </>
          )}
          {isProcessing && (
            <span className="ai-command-bar__hint-label">生成中…</span>
          )}
        </div>

        <div className="ai-command-bar__tools">
          <button
            className={`ai-command-bar__tool-btn${panelOpen ? " ai-command-bar__tool-btn--active" : ""}`}
            onClick={togglePanel}
            title="Agent 面板"
          >
            <ArrowLeftRight size={13} />
            <span>面板</span>
          </button>
          <button
            className="ai-command-bar__tool-btn"
            onClick={closeCommandBar}
            title="关闭 (Esc)"
          >
            <X size={13} />
            <span>关闭</span>
          </button>
        </div>
      </div>
    </div>
  );
}

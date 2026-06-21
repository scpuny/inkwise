// InlineGhostText.tsx — 内联幽灵建议，在光标后显示渐入的 AI 续写/改写内容
// Tab 接受，Esc 忽略，继续打字自动忽略

import { useEffect, useCallback, useRef, useState } from "react";
import { useAgent } from "../lib/agent";

export function InlineGhostText() {
  const { ghostText, setGhostText, acceptGhost, rejectGhost, isProcessing } = useAgent();
  const [visible, setVisible] = useState(false);
  const ghostRef = useRef<HTMLDivElement>(null);

  // Animate in
  useEffect(() => {
    if (ghostText) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [ghostText]);

  // Global keyboard handlers for ghost text
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!ghostText || (e.target as HTMLElement).closest(".ai-command-bar")) return;

    if (e.key === "Tab" && ghostText) {
      e.preventDefault();
      acceptGhost();
      return;
    }

    if (e.key === "Escape" && ghostText && !(e.target as HTMLElement).closest(".ai-command-bar")) {
      e.preventDefault();
      rejectGhost();
      return;
    }

    // If user starts typing normally, dismiss ghost
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && ghostText) {
      const el = e.target as HTMLElement;
      if (el.closest(".tiptap") || el.closest(".editor-markdown-source")) {
        rejectGhost();
      }
    }
  }, [ghostText, acceptGhost, rejectGhost]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!ghostText) return null;

  return (
    <div className={`ghost-text${visible ? " ghost-text--visible" : ""}`} ref={ghostRef}>
      {/* Ghost content */}
      <div className="ghost-text__content">
        {ghostText.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            {i < ghostText.split("\n").length - 1 && <br />}
          </span>
        ))}
        {/* Blinking cursor */}
        <span className="ghost-text__cursor" />
      </div>

      {/* Action hints */}
      <div className="ghost-text__actions">
        <button className="ghost-text__action" onClick={acceptGhost}>
          <kbd>Tab</kbd> 接受
        </button>
        <button className="ghost-text__action ghost-text__action--reject" onClick={rejectGhost}>
          <kbd>Esc</kbd> 忽略
        </button>
        {isProcessing && (
          <span className="ghost-text__generating">生成中…</span>
        )}
      </div>
    </div>
  );
}
